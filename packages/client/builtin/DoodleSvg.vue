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
import type { DoodleProps } from './DoodleProps'
import { and } from '@vueuse/math'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import pencilPointer from '../assets/pencil128.png'
import { useNav } from '../composables/useNav'
import { useSlideContext } from '../context'
import { resolvedClickMap } from '../modules/v-click'
import * as SvgUtils from './SvgUtils'

const props = withDefaults(defineProps<DoodleProps>(), {
  duration: 2000,
  delay: 0,
  strokeWidth: 1,
  strokeColor: 'currentColor',
  fillDelay: 500,
  trigger: false,
  easing: 'linear',
  debug: false,
  autoplay: true,
  autoreset: 'click',
  showPointer: true,
  pointerSrc: pencilPointer,
  pointerSize: 24,
  pointerOffsetX: -2,
  pointerOffsetY: 0,
  pointerGap: 0,
  width: undefined,
  height: undefined,
  sortPaths: false,
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
const rafHandles: number[] = []
const timeoutHandles: number[] = []
const pointerSvgEl = ref<SVGImageElement | SVGCircleElement | null>(null)

const { $slidev, $renderContext, $route } = useSlideContext()
const { isPrintMode } = useNav()

const noPlay = computed(
  () =>
    isPrintMode.value || !['slide', 'presenter'].includes($renderContext.value),
)

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

  SvgUtils.expandUseElements(svgElement.value)
  let paths = SvgUtils.getDrawablePaths(svgElement.value)

  // Sort paths if requested
  if (props.sortPaths) {
    paths = paths
      .map((el) => {
        const tf = SvgUtils.getCombinedTransform(el)
        const pt = SvgUtils.getPathStartPoint(el, tf)
        return { el, pt }
      })
      .sort((a, b) => a.pt.y - b.pt.y || a.pt.x - b.pt.x)
      .map(obj => obj.el)
    if (props.debug) {
      _log('Sorted paths by start point')
    }
  }

  if (props.debug) {
    _log(
      'Found drawable elements:',
      paths.map(p => ({
        tagName: p.tagName,
        attributes: Object.fromEntries(
          Array.from(p.attributes).map(attr => [attr.name, attr.value]),
        ),
      })),
    )
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

  // --- Proportional timing by path length ---
  // Precompute all path data and lengths
  const pathInfos = paths.map((element) => {
    const tf = SvgUtils.getCombinedTransform(element)
    const pathData = SvgUtils.convertToPath(element, tf)
    const pathLength = SvgUtils.getPathLength(pathData)
    return { element, transform: tf, pathData, pathLength }
  })
  // Only keep valid paths
  const validPathInfos = pathInfos.filter(
    info => info.pathData && info.pathLength > 0,
  )
  const totalLength = validPathInfos.reduce(
    (sum, info) => sum + info.pathLength,
    0,
  )
  if (props.debug) {
    _log('Total path length:', totalLength)
  }
  const fillAnimationDuration = props.fillDelay
  const pointerGap = props.pointerGap || 0
  let accumulatedDelay = props.delay

  validPathInfos.forEach((info) => {
    const { element, transform, pathData, pathLength } = info
    const duration
      = totalLength > 0 ? (pathLength / totalLength) * props.duration : 0
    // Add a static debug path if in debug mode
    if (props.debug) {
      const staticPath = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'path',
      )
      staticPath.setAttribute('d', pathData)
      staticPath.style.fill = 'none'
      staticPath.style.stroke = 'red'
      staticPath.style.strokeWidth = '1'
      staticPath.style.opacity = '0.5'
      staticPath.setAttribute('data-debug', 'static-reference')
      element.parentNode?.insertBefore(staticPath, element)
    }
    const pathLengthStr = String(pathLength)
    const newPath = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'path',
    )
    newPath.setAttribute('d', pathData)
    newPath.setAttribute('data-doodle-animated', 'true')
    // If the original element is a <path> and has a transform attribute, copy it to the new path
    if (element.tagName.toLowerCase() === 'path') {
      const originalTransform = element.getAttribute('transform')
      if (originalTransform) {
        newPath.setAttribute('transform', originalTransform)
      }
    }
    // Get all style attributes BEFORE setting any attributes on newPath
    const originalFill = SvgUtils.getEffectiveFill(element)
    const originalStroke
      = SvgUtils.getComputedStyleValue(element, 'stroke') || props.strokeColor
    let originalStrokeWidth
      = SvgUtils.getComputedStyleValue(element, 'stroke-width')
      || String(props.strokeWidth)
    const originalStrokeLinecap
      = SvgUtils.getComputedStyleValue(element, 'stroke-linecap') || 'round'
    const originalStrokeLinejoin
      = SvgUtils.getComputedStyleValue(element, 'stroke-linejoin') || 'round'
    // Scale the stroke width based on the transformation
    const scaleX = Math.sqrt(
      transform.a * transform.a + transform.b * transform.b,
    )
    const scaleY = Math.sqrt(
      transform.c * transform.c + transform.d * transform.d,
    )
    const scale = Math.max(scaleX, scaleY)
    const numericWidth = Number.parseFloat(originalStrokeWidth)
    if (!Number.isNaN(numericWidth)) {
      originalStrokeWidth = String(numericWidth * scale)
    }
    // Apply the attributes in correct order and ensure they're also set as styles
    // Always set stroke and fill explicitly to avoid SVG defaults (black)
    if (originalFill && originalFill !== 'none') {
      newPath.setAttribute('fill', originalFill)
      newPath.style.fill = originalFill
    }
    else {
      newPath.setAttribute('fill', 'none')
      newPath.style.fill = 'none'
    }
    newPath.setAttribute('stroke', originalStroke)
    newPath.style.stroke = originalStroke
    newPath.setAttribute('stroke-width', originalStrokeWidth)
    newPath.style.strokeWidth = originalStrokeWidth
    newPath.setAttribute('stroke-linecap', originalStrokeLinecap)
    newPath.style.strokeLinecap = originalStrokeLinecap
    newPath.setAttribute('stroke-linejoin', originalStrokeLinejoin)
    newPath.style.strokeLinejoin = originalStrokeLinejoin
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
    accumulatedDelay += duration
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
      newPath.style.transition = `stroke-dashoffset ${duration}ms ${props.easing}`
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
      }, duration)
      // Only start pointer animation if pathLength > 0
      if (pathLength > 0) {
        if (props.debug) {
          _log('Starting pointer animation for path:', {
            pathData,
            pathLength,
          })
        }
        // Start the pencil animation
        startPointerAnimation(newPath, pathLength, duration, transform)
        // Visual debug: draw pointer path
        if (props.debug) {
          const pointerDebugPath = document.createElementNS(
            'http://www.w3.org/2000/svg',
            'path',
          )
          pointerDebugPath.setAttribute('d', pathData)
          pointerDebugPath.style.fill = 'none'
          pointerDebugPath.style.stroke = 'blue'
          pointerDebugPath.style.strokeWidth = '1'
          pointerDebugPath.style.opacity = '0.3'
          pointerDebugPath.setAttribute('data-debug', 'pointer-path')
          newPath.parentNode?.insertBefore(
            pointerDebugPath,
            newPath.nextSibling,
          )
        }
      }
    }, strokeStartTime)
  })

  const totalAnimationTime
    = accumulatedDelay + fillAnimationDuration - pointerGap

  addTimeout(() => {
    isAnimating.value = false
    isComplete.value = true
    hasAnimated.value = true
    emit('complete')
  }, totalAnimationTime)
}

function startPointerAnimation(
  pathEl: SVGPathElement,
  pathLength: number,
  duration: number,
  transform?: DOMMatrix,
) {
  if (!props.showPointer || !svgElement.value)
    return

  // Remove any existing SVG pointer
  if (pointerSvgEl.value) {
    pointerSvgEl.value.remove()
    pointerSvgEl.value = null
  }

  let pointer: SVGImageElement | SVGCircleElement
  const size = props.pointerSize ? props.pointerSize : 24
  if (props.pointerSrc) {
    // Use SVG <image> as pointer
    const img = document.createElementNS('http://www.w3.org/2000/svg', 'image')
    img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', props.pointerSrc)
    img.setAttribute('width', String(size))
    img.setAttribute('height', String(size))
    img.setAttribute('class', 'doodle-svg-pointer')
    img.setAttribute('pointer-events', 'none')
    img.setAttribute('style', 'will-change: transform;')
    svgElement.value.appendChild(img)
    pointerSvgEl.value = img as any
    pointer = img
  }
  else {
    // Fallback: use a circle
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
    circle.setAttribute('r', String(size / 2))
    circle.setAttribute('fill', 'red')
    circle.setAttribute('class', 'doodle-svg-pointer')
    circle.setAttribute('pointer-events', 'none')
    circle.setAttribute('style', 'will-change: transform;')
    svgElement.value.appendChild(circle)
    pointerSvgEl.value = circle
    pointer = circle
  }

  const start = performance.now()

  function step(now: number) {
    const elapsed = now - start
    const progress = Math.min(1, elapsed / duration)
    let pt = pathEl.getPointAtLength(pathLength * progress)
    if (transform) {
      pt = new DOMPoint(pt.x, pt.y).matrixTransform(transform)
    }
    if (pointer instanceof SVGImageElement) {
      // Get SVG scale factors
      const svg = svgElement.value as SVGSVGElement
      const svgRect = svg.getBoundingClientRect()
      const viewBox = svg.viewBox.baseVal
      const scaleX = svgRect.width / viewBox.width
      const scaleY = svgRect.height / viewBox.height
      // Calculate the screen position in SVG coordinates
      const screenX = (pt.x + (props.pointerOffsetX || 0)) * scaleX
      const screenY = (pt.y + (props.pointerOffsetY || 0)) * scaleY
      // Place the image at the scaled position
      pointer.setAttribute('x', String(screenX))
      pointer.setAttribute('y', String(screenY))
      // Apply inverse scale to keep image size fixed
      pointer.setAttribute('transform', `scale(${1 / scaleX},${1 / scaleY})`)
      // Set width/height to desired screen pixel size
      pointer.setAttribute('width', String(props.pointerSize || 24))
      pointer.setAttribute('height', String(props.pointerSize || 24))
    }
    else {
      pointer.setAttribute('cx', String(pt.x + (props.pointerOffsetX || 0)))
      pointer.setAttribute('cy', String(pt.y + (props.pointerOffsetY || 0)))
    }
    if (progress < 1) {
      requestAnimationFrame(step)
    }
    else {
      pointer.remove()
      pointerSvgEl.value = null
    }
  }
  requestAnimationFrame(step)
}

function addTimeout(fn: () => void, delay: number) {
  const id = window.setTimeout(fn, delay)
  timeoutHandles.push(id)
  return id
}

// Load external SVG

// Helper: get the start point of a path (or shape)

// Reset animation
function reset() {
  if (!svgElement.value)
    return

  // Remove all animated and debug paths
  svgElement.value
    .querySelectorAll('path[data-doodle-animated="true"], path[data-debug]')
    .forEach(path => path.remove())

  // cancel pending RAFs
  while (rafHandles.length) cancelAnimationFrame(rafHandles.pop()!)

  // cancel pending timeouts
  while (timeoutHandles.length) clearTimeout(timeoutHandles.pop()!)

  // remove any remaining pointer elements (safety: remove all, not just one)
  svgContainer.value
    ?.querySelectorAll('.doodle-svg-pointer')
    .forEach(el => el.remove())

  const hiddenElements = svgElement.value.querySelectorAll(
    '[style*="display: none"]',
  )
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

  pointerSvgEl.value?.remove()
  pointerSvgEl.value = null

  // Remove debug paths
  svgElement.value
    ?.querySelectorAll('path[data-debug="static-reference"]')
    .forEach(path => path.remove())

  if (props.debug) {
    // eslint-disable-next-line no-console
    console.log('DoodleSvg: Reset animation state')
  }
}

// Watch for trigger changes
watch(
  () => props.trigger,
  (newVal) => {
    if (newVal) {
      reset()
      nextTick(() => animate())
    }
  },
)

function _log(...args: any[]) {
  if (props.debug) {
    // eslint-disable-next-line no-console
    console.log(...args)
  }
}

onMounted(async () => {
  if (props.src) {
    const svg = await SvgUtils.loadSvg(props)
    svgContent.value = svg
  }
  await nextTick()
  if (svgContainer.value) {
    svgElement.value = svgContainer.value.querySelector('svg') || undefined
  }
  await nextTick()

  if (noPlay.value)
    return

  const matchRoute = computed(
    () => !!$route && $route.no === $slidev?.nav.currentSlideNo,
  )
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
  watch(
    shouldAnimate,
    async () => {
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
    },
    { immediate: true },
  )

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
  pointer-events: none;
  will-change: transform;
  z-index: 10;
}
</style>
