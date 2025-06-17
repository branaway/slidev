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
}

const props = withDefaults(defineProps<Props>(), {
  duration: 2000,
  delay: 0,
  strokeWidth: 2,
  strokeColor: 'currentColor',
  fillDelay: 500,
  trigger: false,
  easing: 'ease-in-out',
  debug: false,
  autoplay: true,
  autoreset: 'click',
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

const { $slidev, $renderContext, $route } = useSlideContext()
const { isPrintMode } = useNav()

const noPlay = computed(() => isPrintMode.value || !['slide', 'presenter'].includes($renderContext.value))

// Load external SVG
async function loadSvg() {
  if (!props.src)
    return

  try {
    // console.log('external svg:', props.src)
    const response = await fetch(props.src)

    // console.log('response:', response)
    if (response.ok) {
      const text = await response.text()

      // console.log('response.text():', text)
      svgContent.value = text
    }
  }
  catch (ee) {
    console.error(ee)
  }
}

// Get all drawable paths from SVG
function getDrawablePaths(svg: SVGElement): Element[] {
  const selector = 'path, line, polyline, polygon, circle, ellipse, rect'
  return Array.from(svg.querySelectorAll(selector))
}

// Convert shapes to paths for consistent animation
function convertToPath(element: Element): string {
  const tagName = element.tagName.toLowerCase()

  if (tagName === 'path') {
    return (element as SVGPathElement).getAttribute('d') || ''
  }

  if (tagName === 'line') {
    const line = element as SVGLineElement
    const x1 = line.getAttribute('x1') || '0'
    const y1 = line.getAttribute('y1') || '0'
    const x2 = line.getAttribute('x2') || '0'
    const y2 = line.getAttribute('y2') || '0'
    return `M${x1},${y1} L${x2},${y2}`
  }

  if (tagName === 'circle') {
    const circle = element as SVGCircleElement
    const cx = Number.parseFloat(circle.getAttribute('cx') || '0')
    const cy = Number.parseFloat(circle.getAttribute('cy') || '0')
    const r = Number.parseFloat(circle.getAttribute('r') || '0')
    // Create a circle path using two arcs
    return `M${cx - r},${cy} A${r},${r} 0 0,1 ${cx + r},${cy} A${r},${r} 0 0,1 ${cx - r},${cy}`
  }

  if (tagName === 'ellipse') {
    const ellipse = element as SVGEllipseElement
    const cx = Number.parseFloat(ellipse.getAttribute('cx') || '0')
    const cy = Number.parseFloat(ellipse.getAttribute('cy') || '0')
    const rx = Number.parseFloat(ellipse.getAttribute('rx') || '0')
    const ry = Number.parseFloat(ellipse.getAttribute('ry') || '0')
    return `M${cx - rx},${cy} A${rx},${ry} 0 0,1 ${cx + rx},${cy} A${rx},${ry} 0 0,1 ${cx - rx},${cy}`
  }

  if (tagName === 'rect') {
    const rect = element as SVGRectElement
    const x = Number.parseFloat(rect.getAttribute('x') || '0')
    const y = Number.parseFloat(rect.getAttribute('y') || '0')
    const width = Number.parseFloat(rect.getAttribute('width') || '0')
    const height = Number.parseFloat(rect.getAttribute('height') || '0')
    return `M${x},${y} L${x + width},${y} L${x + width},${y + height} L${x},${y + height} Z`
  }

  if (tagName === 'polyline' || tagName === 'polygon') {
    const element_ = element as SVGPolylineElement | SVGPolygonElement
    const points = element_.getAttribute('points') || ''
    if (!points)
      return ''

    const pointsArray = points.trim().split(/[\s,]+/)
    let pathData = ''

    for (let i = 0; i < pointsArray.length; i += 2) {
      const x = pointsArray[i]
      const y = pointsArray[i + 1]
      if (x && y) {
        pathData += i === 0 ? `M${x},${y}` : ` L${x},${y}`
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

// Animate the drawing effect
async function animate() {
  if (!svgElement.value || isAnimating.value)
    return

  isAnimating.value = true
  isComplete.value = false
  emit('start')

  const paths = getDrawablePaths(svgElement.value)

  if (props.debug) {
    // eslint-disable-next-line no-console
    console.log('DoodleSvg animate - paths found for name:', props.name, {
      svgElement: svgElement.value,
      pathCount: paths.length,
      paths,
      svgHTML: svgElement.value.outerHTML,
    })
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

  // Calculate duration per path - divide total duration equally among stroke animations
  const strokeDuration = props.duration / Math.max(paths.length, 1)
  const fillDuration = props.fillDelay

  // Paths start immediately after previous stroke finishes (not waiting for fill)
  const pathStartInterval = strokeDuration

  // Prepare all paths for sequential animation
  paths.forEach((element, index) => {
    const pathData = convertToPath(element)
    if (!pathData) {
      return
    }

    // Create a new path element for drawing
    const newPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    newPath.setAttribute('d', pathData)
    newPath.setAttribute('fill', 'none')
    newPath.setAttribute('stroke', props.strokeColor)
    newPath.setAttribute('stroke-width', String(props.strokeWidth))
    newPath.setAttribute('stroke-linecap', 'round')
    newPath.setAttribute('stroke-linejoin', 'round')

    // Copy other relevant attributes
    const copyAttributes = ['class', 'style', 'transform', 'opacity']
    copyAttributes.forEach((attr) => {
      const value = element.getAttribute(attr)
      if (value && attr !== 'style') {
        newPath.setAttribute(attr, value)
      }
    })

    const pathLength = getPathLength(pathData)

    if (pathLength <= 0) {
      return
    }

    // Set up stroke-dasharray for animation
    const pathLengthStr = String(pathLength)
    newPath.style.transition = `stroke-dashoffset ${strokeDuration}ms ${props.easing}`
    newPath.style.strokeDasharray = pathLengthStr
    newPath.style.strokeDashoffset = pathLengthStr

    // Hide original element
    const elementAsHtml = element as unknown as HTMLElement
    elementAsHtml.style.display = 'none'

    // Insert new path
    element.parentNode?.insertBefore(newPath, element)

    // Calculate when this path should start (right after previous stroke finishes)
    const pathStartTime = props.delay + (index * pathStartInterval)

    if (props.debug) {
      // eslint-disable-next-line no-console
      console.log(`Path ${index + 1} timing:`, {
        startTime: pathStartTime,
        strokeDuration,
        fillDuration,
        strokeInterval: pathStartInterval,
      })
    }

    // Start stroke animation
    setTimeout(() => {
      newPath.style.strokeDashoffset = '0'

      // Start fill animation after stroke completes
      setTimeout(() => {
        const originalFill = element.getAttribute('fill')
        if (originalFill && originalFill !== 'none') {
          newPath.style.transition = `fill ${fillDuration}ms ease-in-out`
          newPath.setAttribute('fill', originalFill)
        }
      }, strokeDuration)
    }, pathStartTime)
  })

  // Calculate total animation time - last stroke + fill duration
  const lastStrokeStartTime = props.delay + ((paths.length - 1) * pathStartInterval)
  const totalAnimationTime = lastStrokeStartTime + strokeDuration + fillDuration

  if (props.debug) {
    // eslint-disable-next-line no-console
    console.log('Sequential animation timing:', {
      pathCount: paths.length,
      strokeDuration,
      fillDuration,
      strokeInterval: pathStartInterval,
      totalAnimationTime,
    })
  }

  setTimeout(() => {
    isAnimating.value = false
    isComplete.value = true
    hasAnimated.value = true
    emit('complete')
  }, totalAnimationTime)
}

// Reset animation
function reset() {
  if (!svgElement.value)
    return

  const animatedPaths = svgElement.value.querySelectorAll('path[style*="stroke-dasharray"]')
  animatedPaths.forEach(path => path.remove())

  const hiddenElements = svgElement.value.querySelectorAll('[style*="display: none"]')
  hiddenElements.forEach((el) => {
    (el as HTMLElement).style.display = ''
  })

  isAnimating.value = false
  isComplete.value = false
  hasAnimated.value = false

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

  watch(shouldAnimate, () => {
    if (shouldAnimate.value) {
      if (props.autoplay && !hasAnimated.value)
        animate()
    }
    else {
      if (props.autoreset === 'click' || (props.autoreset === 'slide' && !matchRoute.value)) {
        reset()
        hasAnimated.value = false
      }
    }
  }, { immediate: true })
})

// Expose methods for manual control
defineExpose({
  animate,
  reset,
  isAnimating: computed(() => isAnimating.value),
  isComplete: computed(() => isComplete.value),
  hasAnimated: computed(() => hasAnimated.value),
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
}

.doodle-svg-container svg {
  width: 100%;
  height: auto;
}
</style>
