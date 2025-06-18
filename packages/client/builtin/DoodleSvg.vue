<!--
DoodleSvg Component
Progressive SVG drawing effect

Usage:
```md
<DoodleSvg src="/path/to/your.svg" :duration="3000" :delay="500" />
```

Or with inline SVG:
```md
<DoodleSvg :duration="2000">
  <svg viewBox="0 0 100 100">
    <path d="M10,10 L90,90" />
    <circle cx="50" cy="50" r="20" />
  </svg>
</DoodleSvg>
```
-->

<script setup lang="ts">
import { and } from '@vueuse/math'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useNav } from '../composables/useNav'
import { useSlideContext } from '../context'
import { resolvedClickMap } from '../modules/v-click'

interface Props {
  name?: string
  src?: string
  duration?: number
  delay?: number
  strokeWidth?: number
  strokeColor?: string
  fillDelay?: number
  trigger?: boolean
  easing?: string
  debug?: boolean
  autoplay?: boolean
  autoreset?: 'slide' | 'click'
  showPointer?: boolean
  pointerSrc?: string
  pointerSize?: number
  pointerOffsetX?: number
  pointerOffsetY?: number
  pointerGap?: number
  width?: number // in pixels, user override
  height?: number // in pixels, user override
}

const props = withDefaults(defineProps<Props>(), {
  duration: 2000,
  delay: 0,
  strokeWidth: 2,
  strokeColor: 'currentColor',
  fillDelay: 500,
  trigger: false,
  easing: 'linear',
  debug: false,
  autoplay: true,
  autoreset: 'click',
  showPointer: true,
  pointerSrc: '/arrow-pointer.svg',
  pointerSize: 24,
  pointerOffsetX: 0,
  pointerOffsetY: 0,
  pointerGap: 0,
  width: undefined,
  height: undefined,
})

const emit = defineEmits<{
  start: []
  complete: []
}>()

const svgContainer = ref<HTMLDivElement>()
const svgElement = ref<SVGElement>()
const isAnimating = ref(false)
const isComplete = ref(false)
const svgContent = ref('')
const hasAnimated = ref(false)
const pointerImg = ref<HTMLImageElement>()
const rafHandles: number[] = []
const timeoutHandles: number[] = []

const { $slidev, $renderContext, $route } = useSlideContext()
const { isPrintMode } = useNav()

const noPlay = computed(() => isPrintMode.value || !['slide', 'presenter'].includes($renderContext.value))

// Load external SVG
async function loadSvg() {
  if (!props.src)
    return

  try {
    const response = await fetch(props.src)
    if (response.ok) {
      let text = await response.text()
      const parser = new DOMParser()
      const doc = parser.parseFromString(text, 'image/svg+xml')
      const svg = doc.querySelector('svg')
      if (svg) {
        // --- Efficient scaling logic start ---
        // Set viewBox if missing (use width/height if available, else fallback to 0 0 200 200)
        if (!svg.getAttribute('viewBox')) {
          const width = svg.getAttribute('width')
          const height = svg.getAttribute('height')
          if (width && height) {
            svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
          }
          else {
            svg.setAttribute('viewBox', '0 0 200 200')
          }
        }
        // Set/remove width/height based on user props
        if (props.width)
          svg.setAttribute('width', String(props.width))
        else
          svg.removeAttribute('width')
        if (props.height)
          svg.setAttribute('height', String(props.height))
        else
          svg.removeAttribute('height')
        // --- Efficient scaling logic end ---
        // Serialize back to string
        text = svg.outerHTML
      }
      svgContent.value = text
    }
  }
  catch (ee) {
    console.error(ee)
  }
}

// Parse transform string into matrix components
function parseTransform(transformStr: string): DOMMatrix {
  if (!transformStr) {
    return new DOMMatrix()
  }

  // Create a temporary SVG element to parse the transform
  const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  const tempG = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  tempG.setAttribute('transform', transformStr)
  tempSvg.appendChild(tempG)
  document.body.appendChild(tempSvg)

  const matrix = tempG.transform.baseVal.consolidate()?.matrix || new DOMMatrix()
  document.body.removeChild(tempSvg)

  return new DOMMatrix([matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f])
}

function _log(...args: any[]) {
  if (props.debug) {
    // eslint-disable-next-line no-console
    console.log(...args)
  }
}

// Calculate combined transformation matrix from element to SVG root
function getCombinedTransform(element: Element): DOMMatrix {
  let combined = new DOMMatrix()
  let current = element as Element | null

  const transforms: DOMMatrix[] = []

  while (current && current.tagName.toLowerCase() !== 'svg') {
    const transform = current.getAttribute('transform')
    if (transform) {
      const matrix = parseTransform(transform)
      transforms.unshift(matrix) // Add to start of array to apply in correct order
    }
    current = current.parentElement
  }

  // Apply transforms in order from root to element
  for (const matrix of transforms) {
    combined = combined.multiply(matrix)
  }

  if (props.debug) {
    _log('Combined transform for element:', {
      element: element.outerHTML,
      transforms: transforms.map(t => ({
        a: t.a,
        b: t.b,
        c: t.c,
        d: t.d,
        e: t.e,
        f: t.f,
      })),
      result: {
        a: combined.a,
        b: combined.b,
        c: combined.c,
        d: combined.d,
        e: combined.e,
        f: combined.f,
      },
    })
  }

  return combined
}

// Apply transformation matrix to point
function transformPoint(x: number, y: number, matrix: DOMMatrix): { x: number, y: number } {
  const point = new DOMPoint(x, y)
  const transformed = point.matrixTransform(matrix)
  return { x: transformed.x, y: transformed.y }
}

// Get computed style value, including inherited values from parent groups
function getComputedStyleValue(element: Element, property: string): string {
  // First check the element itself
  const directValue = element.getAttribute(property)
  if (directValue && directValue !== 'none') {
    return directValue
  }

  // Check parent elements up to the SVG root
  let current = element.parentElement
  while (current && current.tagName.toLowerCase() !== 'svg') {
    const parentValue = current.getAttribute(property)
    if (parentValue && parentValue !== 'none') {
      return parentValue
    }
    current = current.parentElement
  }

  // Check if there's a style attribute that might contain the property
  const styleAttr = element.getAttribute('style')
  if (styleAttr) {
    const styles = styleAttr.split(';').map(s => s.trim())
    for (const style of styles) {
      const [prop, value] = style.split(':').map(s => s.trim())
      if (prop === property && value !== 'none') {
        return value
      }
    }
  }

  return ''
}

// Get fill color including inherited values
function getEffectiveFill(element: Element): string {
  // Skip elements with fill="none" and look for inherited fill
  let current = element as Element | null
  while (current && current.tagName !== 'svg') {
    const fill = current.getAttribute('fill')
    if (fill && fill !== 'none') {
      return fill
    }
    current = current.parentElement
  }
  return ''
}

// Expand use elements to actual content before animation
function expandUseElements(svg: SVGElement): void {
  const useElements = Array.from(svg.querySelectorAll('use'))

  for (const useElement of useElements) {
    const href = useElement.getAttribute('xlink:href') || useElement.getAttribute('href')
    if (!href || !href.startsWith('#')) {
      continue
    }

    const referencedId = href.substring(1)
    const referencedElement = svg.querySelector(`#${referencedId}`)

    if (!referencedElement) {
      continue
    }

    // Clone the referenced element
    const clone = referencedElement.cloneNode(true) as Element

    // Remove the id to avoid duplicates
    clone.removeAttribute('id')

    // Create a group to hold the cloned content with use element's attributes
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g')

    // Copy relevant attributes from use element to group
    const attributesToCopy = ['transform', 'opacity', 'class', 'style']
    attributesToCopy.forEach((attr) => {
      const value = useElement.getAttribute(attr)
      if (value) {
        group.setAttribute(attr, value)
      }
    })

    // Add the cloned content to the group
    if (clone.tagName === 'g') {
      // If referenced element is a group, copy its children
      Array.from(clone.children).forEach((child) => {
        group.appendChild(child.cloneNode(true))
      })
    }
    else {
      // If referenced element is a single element, add it directly
      group.appendChild(clone)
    }

    // Replace the use element with the expanded group
    useElement.parentNode?.replaceChild(group, useElement)

    if (props.debug) {
      // eslint-disable-next-line no-console
      console.log(`Expanded use element referencing #${referencedId}`)
    }
  }
}

// Get all drawable paths from SVG
function getDrawablePaths(svg: SVGElement): Element[] {
  const selector = 'path, line, polyline, polygon, circle, ellipse, rect'
  return Array.from(svg.querySelectorAll(selector))
}

// Convert shapes to paths for consistent animation
function convertToPath(element: Element, transform: DOMMatrix): string {
  const tagName = element.tagName.toLowerCase()

  if (tagName === 'path') {
    return (element as SVGPathElement).getAttribute('d') || ''
  }

  if (tagName === 'line') {
    const line = element as SVGLineElement
    const x1 = Number.parseFloat(line.getAttribute('x1') || '0')
    const y1 = Number.parseFloat(line.getAttribute('y1') || '0')
    const x2 = Number.parseFloat(line.getAttribute('x2') || '0')
    const y2 = Number.parseFloat(line.getAttribute('y2') || '0')

    const p1 = transformPoint(x1, y1, transform)
    const p2 = transformPoint(x2, y2, transform)

    return `M${p1.x},${p1.y} L${p2.x},${p2.y}`
  }

  if (tagName === 'circle') {
    const circle = element as SVGCircleElement
    const cx = Number.parseFloat(circle.getAttribute('cx') || '0')
    const cy = Number.parseFloat(circle.getAttribute('cy') || '0')
    const r = Number.parseFloat(circle.getAttribute('r') || '0')

    if (props.debug) {
      _log('Circle conversion:', {
        element: circle.outerHTML,
        original: { cx, cy, r },
        transform: {
          a: transform.a,
          b: transform.b,
          c: transform.c,
          d: transform.d,
          e: transform.e,
          f: transform.f,
        },
      })
    }

    // Get the center point after transformation
    const center = transformPoint(cx, cy, transform)

    // Calculate the transformed radius by transforming a point at distance r
    const radiusPoint = transformPoint(cx + r, cy, transform)
    const transformedR = Math.hypot(radiusPoint.x - center.x, radiusPoint.y - center.y)

    if (props.debug) {
      _log('Circle transformation:', {
        center,
        transformedR,
        radiusPoint,
      })
    }

    // Create a circle path using four quarter-circle arcs for better precision
    const path = [
      `M${center.x},${center.y - transformedR}`,
      `A${transformedR},${transformedR} 0 0,1 ${center.x + transformedR},${center.y}`,
      `A${transformedR},${transformedR} 0 0,1 ${center.x},${center.y + transformedR}`,
      `A${transformedR},${transformedR} 0 0,1 ${center.x - transformedR},${center.y}`,
      `A${transformedR},${transformedR} 0 0,1 ${center.x},${center.y - transformedR}`,
      'Z',
    ].join(' ')

    if (props.debug) {
      _log('Generated circle path:', path)
    }

    return path
  }

  if (tagName === 'ellipse') {
    const ellipse = element as SVGEllipseElement
    const cx = Number.parseFloat(ellipse.getAttribute('cx') || '0')
    const cy = Number.parseFloat(ellipse.getAttribute('cy') || '0')
    const rx = Number.parseFloat(ellipse.getAttribute('rx') || '0')
    const ry = Number.parseFloat(ellipse.getAttribute('ry') || '0')

    const center = transformPoint(cx, cy, transform)
    const scaleX = Math.sqrt(transform.a * transform.a + transform.b * transform.b)
    const scaleY = Math.sqrt(transform.c * transform.c + transform.d * transform.d)
    const transformedRx = rx * scaleX
    const transformedRy = ry * scaleY

    return `M${center.x - transformedRx},${center.y} A${transformedRx},${transformedRy} 0 0,1 ${center.x + transformedRx},${center.y} A${transformedRx},${transformedRy} 0 0,1 ${center.x - transformedRx},${center.y}`
  }

  if (tagName === 'rect') {
    const rect = element as SVGRectElement
    const x = Number.parseFloat(rect.getAttribute('x') || '0')
    const y = Number.parseFloat(rect.getAttribute('y') || '0')
    const width = Number.parseFloat(rect.getAttribute('width') || '0')
    const height = Number.parseFloat(rect.getAttribute('height') || '0')

    const topLeft = transformPoint(x, y, transform)
    const topRight = transformPoint(x + width, y, transform)
    const bottomRight = transformPoint(x + width, y + height, transform)
    const bottomLeft = transformPoint(x, y + height, transform)

    return `M${topLeft.x},${topLeft.y} L${topRight.x},${topRight.y} L${bottomRight.x},${bottomRight.y} L${bottomLeft.x},${bottomLeft.y} Z`
  }

  if (tagName === 'polyline' || tagName === 'polygon') {
    const element_ = element as SVGPolylineElement | SVGPolygonElement
    const points = element_.getAttribute('points') || ''
    if (!points)
      return ''

    const pointsArray = points.trim().split(/[\s,]+/)
    let pathData = ''

    for (let i = 0; i < pointsArray.length; i += 2) {
      const x = Number.parseFloat(pointsArray[i] || '0')
      const y = Number.parseFloat(pointsArray[i + 1] || '0')
      if (!Number.isNaN(x) && !Number.isNaN(y)) {
        const transformed = transformPoint(x, y, transform)
        pathData += i === 0 ? `M${transformed.x},${transformed.y}` : ` L${transformed.x},${transformed.y}`
      }
    }

    if (tagName === 'polygon') {
      pathData += ' Z'
    }

    return pathData
  }

  return ''
}

// Calculate path length more reliably
function getPathLength(pathData: string): number {
  if (!pathData)
    return 0

  try {
    const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    tempSvg.style.position = 'absolute'
    tempSvg.style.visibility = 'hidden'
    tempSvg.style.width = '0'
    tempSvg.style.height = '0'

    const tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    tempPath.setAttribute('d', pathData)

    tempSvg.appendChild(tempPath)
    document.body.appendChild(tempSvg)

    const length = tempPath.getTotalLength?.() || 0
    document.body.removeChild(tempSvg)

    return length
  }
  catch {}
  return 100 // fallback length
}

function addTimeout(fn: () => void, delay: number) {
  const id = window.setTimeout(fn, delay)
  timeoutHandles.push(id)
  return id
}

// Animate the drawing effect
async function animate() {
  if (!svgElement.value || isAnimating.value)
    return

  if (props.debug) {
    _log('Starting animation with SVG:', svgElement.value.outerHTML)
  }

  isAnimating.value = true
  isComplete.value = false
  emit('start')

  expandUseElements(svgElement.value)
  const paths = getDrawablePaths(svgElement.value)

  if (props.debug) {
    _log('Found drawable elements:', paths.map(p => ({
      tagName: p.tagName,
      attributes: Object.fromEntries(
        Array.from(p.attributes).map(attr => [attr.name, attr.value]),
      ),
    })))
  }

  if (paths.length === 0) {
    if (props.debug) {
      // eslint-disable-next-line no-console
      console.log('DoodleSvg animate - no paths found, completing immediately')
    }
    isAnimating.value = false
    isComplete.value = true
    emit('complete')
    return
  }

  const strokeDurationPerPath = props.duration / Math.max(paths.length, 1)
  const fillAnimationDuration = props.fillDelay
  const pointerGap = props.pointerGap || 0
  let accumulatedDelay = props.delay

  paths.forEach((element, index) => {
    const transform = getCombinedTransform(element)
    const pathData = convertToPath(element, transform)

    if (!pathData) {
      if (props.debug && element.tagName.toLowerCase() === 'circle') {
        _log(`Circle element at index ${index} was skipped.`, {
          element,
          reason: 'No path data generated',
          attributes: Array.from(element.attributes).map(attr => `${attr.name}="${attr.value}"`),
        })
      }
      return
    }

    // Add a static debug path if in debug mode
    if (props.debug) {
      const staticPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      staticPath.setAttribute('d', pathData)
      staticPath.style.fill = 'none'
      staticPath.style.stroke = 'red'
      staticPath.style.strokeWidth = '2'
      staticPath.style.opacity = '0.5'
      staticPath.setAttribute('data-debug', 'static-reference')
      element.parentNode?.insertBefore(staticPath, element)
    }

    const pathLength = getPathLength(pathData)
    if (pathLength <= 0)
      return

    const pathLengthStr = String(pathLength)
    const newPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    newPath.setAttribute('d', pathData)
    newPath.setAttribute('data-doodle-animated', 'true')

    // Get all style attributes BEFORE setting any attributes on newPath
    const originalFill = getEffectiveFill(element)
    const originalStroke = getComputedStyleValue(element, 'stroke') || props.strokeColor
    let originalStrokeWidth = getComputedStyleValue(element, 'stroke-width') || String(props.strokeWidth)
    const originalStrokeLinecap = getComputedStyleValue(element, 'stroke-linecap') || 'round'
    const originalStrokeLinejoin = getComputedStyleValue(element, 'stroke-linejoin') || 'round'

    // Scale the stroke width based on the transformation
    const scaleX = Math.sqrt(transform.a * transform.a + transform.b * transform.b)
    const scaleY = Math.sqrt(transform.c * transform.c + transform.d * transform.d)
    const scale = Math.max(scaleX, scaleY)
    const numericWidth = Number.parseFloat(originalStrokeWidth)
    if (!Number.isNaN(numericWidth)) {
      originalStrokeWidth = String(numericWidth * scale)
    }

    // Apply the attributes in correct order and ensure they're also set as styles
    newPath.setAttribute('fill', 'none') // Start with no fill
    newPath.setAttribute('stroke', originalStroke)
    newPath.setAttribute('stroke-width', originalStrokeWidth)
    newPath.setAttribute('stroke-linecap', originalStrokeLinecap)
    newPath.setAttribute('stroke-linejoin', originalStrokeLinejoin)

    // Set initial styles
    newPath.style.fill = 'none'
    newPath.style.stroke = originalStroke
    newPath.style.strokeWidth = originalStrokeWidth
    newPath.style.strokeLinecap = originalStrokeLinecap
    newPath.style.strokeLinejoin = originalStrokeLinejoin

    // Setup the stroke dash animation
    newPath.style.strokeDasharray = `${pathLengthStr}`
    newPath.style.strokeDashoffset = `${pathLengthStr}`

    const elementAsHtml = element as unknown as HTMLElement
    elementAsHtml.style.display = 'none'

    element.parentNode?.insertBefore(newPath, element.nextSibling)

    const strokeStartTime = accumulatedDelay
    accumulatedDelay += strokeDurationPerPath

    // Ensure the path is visible before animation
    newPath.style.opacity = '1'
    newPath.style.visibility = 'visible'

    // Start the stroke animation
    addTimeout(() => {
      // Set initial state
      newPath.style.strokeDasharray = pathLengthStr
      newPath.style.strokeDashoffset = pathLengthStr
      newPath.style.transition = 'none'

      // Force layout (flush)
      newPath.getBoundingClientRect()

      // Set transition and start animation
      newPath.style.transition = `stroke-dashoffset ${strokeDurationPerPath}ms ${props.easing}`
      newPath.style.strokeDashoffset = '0'

      // After stroke animation, animate the fill
      addTimeout(() => {
        if (originalFill && originalFill !== 'none') {
          newPath.style.transition = `fill ${fillAnimationDuration}ms ease-in-out`
          requestAnimationFrame(() => {
            newPath.style.fill = originalFill
            newPath.setAttribute('fill', originalFill)
          })
        }
        // Clean up dash settings so no residual artifacts remain
        newPath.style.strokeDasharray = ''
        newPath.style.strokeDashoffset = ''
      }, strokeDurationPerPath)

      startPointerAnimation(newPath, pathLength, strokeDurationPerPath)
    }, strokeStartTime)
  })

  const totalAnimationTime = accumulatedDelay + fillAnimationDuration - pointerGap

  addTimeout(() => {
    isAnimating.value = false
    isComplete.value = true
    hasAnimated.value = true
    emit('complete')
  }, totalAnimationTime)
}

function startPointerAnimation(pathEl: SVGPathElement, pathLength: number, duration: number) {
  if (!props.showPointer || !svgElement.value || !svgContainer.value)
    return

  // Remove any existing pointer and cancel pointer-related RAFs
  if (pointerImg.value) {
    pointerImg.value.remove()
    pointerImg.value = undefined as any
  }
  while (rafHandles.length)
    cancelAnimationFrame(rafHandles.pop()!)

  // Ensure container is positioned relative for absolute children
  const container = svgContainer.value
  const containerStyle = getComputedStyle(container)
  if (containerStyle.position === 'static')
    container.style.position = 'relative'

  // Create the pointer element
  const pointer = document.createElement('img')
  pointer.src = props.pointerSrc
  pointer.className = 'doodle-svg-pointer'
  pointer.style.width = `${props.pointerSize}px`
  pointer.style.position = 'absolute'
  pointer.style.left = '0'
  pointer.style.top = '0'
  pointer.style.transform = 'translate(0, 0)'
  pointer.style.pointerEvents = 'none'
  container.appendChild(pointer)
  pointerImg.value = pointer

  const start = performance.now()
  const svgCTM = (svgElement.value as unknown as SVGGraphicsElement).getScreenCTM()
  if (!svgCTM)
    return

  function step(now: number) {
    const elapsed = now - start
    const progress = Math.min(1, elapsed / duration)
    const pt = pathEl.getPointAtLength(pathLength * progress)
    const globalPoint = new DOMPoint(pt.x, pt.y).matrixTransform(svgCTM!)
    const rect = container.getBoundingClientRect()
    const localX = globalPoint.x - rect.left + props.pointerOffsetX
    const localY = globalPoint.y - rect.top + props.pointerOffsetY

    pointer.style.left = `${localX}px`
    pointer.style.top = `${localY}px`
    pointer.style.transform = 'translate(0, 0)'

    if (progress < 1) {
      const id2 = requestAnimationFrame(step)
      rafHandles.push(id2)
    }
    else {
      pointer.remove()
      pointerImg.value = undefined as any
    }
  }
  const id = requestAnimationFrame(step)
  rafHandles.push(id)
}

// Reset animation
function reset() {
  if (!svgElement.value)
    return

  const animatedPaths = svgElement.value.querySelectorAll('path[data-doodle-animated="true"]')
  animatedPaths.forEach(path => path.remove())

  // cancel pending RAFs
  while (rafHandles.length)
    cancelAnimationFrame(rafHandles.pop()!)

  // cancel pending timeouts
  while (timeoutHandles.length)
    clearTimeout(timeoutHandles.pop()!)

  // remove any remaining pointer elements
  svgContainer.value?.querySelectorAll('.doodle-svg-pointer').forEach(el => el.remove())

  const hiddenElements = svgElement.value.querySelectorAll('[style*="display: none"]')
  hiddenElements.forEach((el) => {
    (el as HTMLElement).style.display = ''
  })

  // Reset any expanded use elements by reloading the SVG
  if (props.src && svgContent.value) {
    const container = svgContainer.value
    if (container) {
      const svgDiv = container.querySelector('div')
      if (svgDiv) {
        svgDiv.innerHTML = svgContent.value
        svgElement.value = container.querySelector('svg') || undefined
      }
    }
  }

  isAnimating.value = false
  isComplete.value = false
  hasAnimated.value = false

  pointerImg.value?.remove()
  pointerImg.value = undefined as any

  // Remove debug paths
  svgElement.value?.querySelectorAll('path[data-debug="static-reference"]').forEach(path => path.remove())

  if (props.debug) {
    // eslint-disable-next-line no-console
    console.log('DoodleSvg: Reset animation state')
  }
}

// Watch for trigger changes
watch(() => props.trigger, (newVal) => {
  if (newVal) {
    reset()
    nextTick(() => animate())
  }
})

onMounted(async () => {
  if (props.src) {
    await loadSvg()
  }
  await nextTick()
  if (svgContainer.value) {
    svgElement.value = svgContainer.value.querySelector('svg') || undefined
  }
  await nextTick()

  if (noPlay.value)
    return

  const matchRoute = computed(() => !!$route && $route.no === $slidev?.nav.currentSlideNo)
  const matchClick = computed(() => {
    if (!svgContainer.value)
      return true

    // Check if this element or any parent has v-click
    let element = svgContainer.value as Element | null
    while (element) {
      const clickInfo = resolvedClickMap.get(element)
      if (clickInfo) {
        return clickInfo.isShown.value
      }
      element = element.parentElement
    }

    // Default to true if no v-click found
    return true
  })
  const shouldAnimate = and(matchRoute, matchClick)

  // React when route matches and v-click visibility changes
  watch(shouldAnimate, async () => {
    if (shouldAnimate.value) {
      if (props.autoplay && !hasAnimated.value) {
        reset()
        await nextTick()
        animate()
      }
    }
    else {
      // becomes not visible – clean up
      reset()
    }
  }, { immediate: true })

  // Expose methods for manual control
  defineExpose({
    animate,
    reset,
    isAnimating: computed(() => isAnimating.value),
    isComplete: computed(() => isComplete.value),
    hasAnimated: computed(() => hasAnimated.value),
  })
})
</script>

<template>
  <div ref="svgContainer" class="doodle-svg-container">
    <!-- External SVG -->
    <div v-if="src && svgContent" v-html="svgContent" />

    <!-- Inline SVG -->
    <slot v-else />
  </div>
</template>

<style scoped>
.doodle-svg-container {
  display: inline-block;
  position: relative; /* for pointer positioning */
}

.doodle-svg-container svg {
  width: auto;
  height: auto;
  max-width: 200px;
  max-height: 200px;
}

.doodle-svg-pointer {
  position: absolute;
  pointer-events: none;
  user-select: none;
  transform-origin: 0 0; /* tip of pointer */
}
</style>
