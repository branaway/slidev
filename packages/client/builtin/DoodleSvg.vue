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
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useNav } from '../composables/useNav'
import { useSlideContext } from '../context'

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

const { $renderContext, $page } = useSlideContext()
const { currentPage } = useNav()
const slideContext = useSlideContext()
const isActive = computed(() => $renderContext.value === 'slide' || $renderContext.value === 'presenter')

let hasAnimated = false
let isStartingAnimation = false

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
    console.log('DoodleSvg animate - paths found:', {
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

  const totalDuration = props.duration
  const pathDuration = totalDuration / Math.max(paths.length, 1)

  // Prepare all paths for animation
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
    newPath.setAttribute('stroke-width', props.strokeWidth.toString())
    newPath.setAttribute('stroke-linecap', 'round')
    newPath.setAttribute('stroke-linejoin', 'round')

    // Copy other relevant attributes
    const copyAttributes = ['class', 'style', 'transform', 'opacity']
    copyAttributes.forEach((attr) => {
      const value = element.getAttribute(attr)
      if (value && attr !== 'style') { // Don't copy style as it might contain display:none
        newPath.setAttribute(attr, value)
      }
    })

    const pathLength = getPathLength(pathData)

    if (pathLength <= 0) {
      return
    }

    // Set up stroke-dasharray for animation
    newPath.style.transition = `stroke-dashoffset ${pathDuration}ms ${props.easing}`
    newPath.style.strokeDasharray = pathLength.toString()
    newPath.style.strokeDashoffset = pathLength.toString();

    // Hide original element
    (element as unknown as HTMLElement).style.display = 'none'

    // Insert new path
    element.parentNode?.insertBefore(newPath, element)

    // Start animation with delay
    const animationDelay = index * (pathDuration * 0.2) + props.delay

    setTimeout(() => {
      newPath.style.strokeDashoffset = '0'

      // Handle fill after stroke animation
      setTimeout(() => {
        const originalFill = element.getAttribute('fill')
        if (originalFill && originalFill !== 'none') {
          newPath.style.transition = `fill ${props.fillDelay}ms ease-in-out`
          newPath.setAttribute('fill', originalFill)
        }
      }, pathDuration)
    }, animationDelay)
  })

  // Mark as complete when all animations finish
  const totalAnimationTime = (paths.length - 1) * (pathDuration * 0.2) + pathDuration + props.delay + props.fillDelay
  setTimeout(() => {
    isAnimating.value = false
    isComplete.value = true
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
  hasAnimated = false
  isStartingAnimation = false

  if (props.debug) {
    // eslint-disable-next-line no-console
    console.log('DoodleSvg: Reset animation state')
  }
}

// Watch for trigger changes
watch(() => props.trigger, (newVal) => {
  if (newVal) {
    reset()
    nextTick(() => startAnimationSafe())
  }
})

function startAnimationSafe() {
  if (isStartingAnimation || hasAnimated) {
    if (props.debug) {
      // eslint-disable-next-line no-console
      console.log('DoodleSvg: Animation already starting or completed', { isStartingAnimation, hasAnimated })
    }
    return false
  }

  isStartingAnimation = true
  if (props.debug) {
    // eslint-disable-next-line no-console
    console.log('DoodleSvg: Starting animation (safe)')
  }

  animate()
  hasAnimated = true

  // Reset the starting flag after a delay
  setTimeout(() => {
    isStartingAnimation = false
  }, 100)

  return true
}

function isSvgVisible() {
  if (!svgElement.value) {
    if (props.debug) {
      // eslint-disable-next-line no-console
      console.log('isSvgVisible: no svgElement')
    }
    return false
  }

  // Check if element is in the DOM and potentially visible
  const rect = svgElement.value.getBoundingClientRect()
  const isInDOM = svgElement.value.isConnected
  const hasContainer = svgContainer.value !== null

  // Use click context to determine if we should be visible
  const currentClicks = slideContext.$clicksContext.current

  // Find if we're inside a v-click element and get its click number
  const vClickElement = svgContainer.value?.closest('[data-v-click]')
  let requiredClicks = 0

  if (props.debug) {
    // eslint-disable-next-line no-console
    console.log('DoodleSvg v-click detection:', {
      pageId: props.name,
      svgContainer: !!svgContainer.value,
      vClickElement: !!vClickElement,
      vClickElementTag: vClickElement?.tagName,
      vClickElementClasses: vClickElement ? Array.from(vClickElement.classList) : [],
      dataVClick: vClickElement?.getAttribute('data-v-click'),
    })
  }

  if (vClickElement) {
    const clickAttr = vClickElement.getAttribute('data-v-click')
    if (clickAttr) {
      requiredClicks = Number.parseInt(clickAttr, 10) || 0
    }
  }

  // Component should be visible if current clicks >= required clicks
  const shouldBeVisible = currentClicks >= requiredClicks
  const isVisible = isInDOM && hasContainer && shouldBeVisible

  if (props.debug) {
    // eslint-disable-next-line no-console
    console.log('isSvgVisible check:', {
      width: rect.width,
      height: rect.height,
      isInDOM,
      hasContainer,
      currentClicks,
      requiredClicks,
      shouldBeVisible,
      isVisible,
      vClickElement: !!vClickElement,
      svgElement: svgElement.value,
    })
  }

  return isVisible
}

// Watch for when we should start the animation - improved timing
watch(
  [$page, currentPage, isActive, svgElement, () => slideContext.$clicksContext.current],
  async () => {
    if (!svgElement.value)
      return

    const isCurrentPage = $page.value === currentPage.value

    if (props.debug) {
      // eslint-disable-next-line no-console
      console.log('DoodleSvg watch triggered:', {
        pageId: props.name,
        page: $page.value,
        currentPage: currentPage.value,
        isCurrentPage,
        isActive: isActive.value,
        hasAnimated,
        svgVisible: isSvgVisible(),
        autoplay: props.autoplay,
        trigger: props.trigger,
        currentClicks: slideContext.$clicksContext.current,
      })
    }

    // Reset if we navigate away from this page
    if (!isCurrentPage) {
      if (props.debug) {
        // eslint-disable-next-line no-console
        console.log('DoodleSvg: Resetting animation (left page)')
      }
      reset()
      hasAnimated = false
      return
    }

    // Only animate when this page is the current page
    const shouldAnimate = isCurrentPage
      && isActive.value
      && isSvgVisible()
      && props.autoplay
      && !props.trigger
      && !hasAnimated

    if (props.debug) {
      // eslint-disable-next-line no-console
      console.log('DoodleSvg shouldAnimate conditions:', {
        isCurrentPage,
        isActive: isActive.value,
        isSvgVisible: isSvgVisible(),
        autoplay: props.autoplay,
        trigger: props.trigger,
        hasAnimated,
        shouldAnimate,
      })
    }

    if (shouldAnimate) {
      // Add small delay to ensure page navigation is complete
      await nextTick()
      setTimeout(() => {
        if ($page.value === currentPage.value && !hasAnimated) {
          startAnimationSafe()
        }
      }, 100) // Small delay to ensure stable navigation
    }
  },
  { flush: 'post' }, // Changed from immediate: true to flush: 'post'
)

onMounted(async () => {
  if (props.src) {
    await loadSvg()
  }
  await nextTick()
  if (svgContainer.value) {
    svgElement.value = svgContainer.value.querySelector('svg') || undefined
  }
  await nextTick()
  // No need to start polling here anymore
})

// Expose methods for manual control
defineExpose({
  animate,
  reset,
  isAnimating: computed(() => isAnimating.value),
  isComplete: computed(() => isComplete.value),
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
