<script setup lang="ts">
import { provideLocal, useElementSize, useStyleTag } from '@vueuse/core'
import { computed, ref } from 'vue'
import { useNav } from '../composables/useNav'
import { injectionSlideElement, injectionSlideScale } from '../constants'
import { slideAspect, slideHeight, slideWidth } from '../env'
import { isDark } from '../logic/dark'
import { snapshotManager } from '../logic/snapshot'
import { slideScale } from '../state'

const props = defineProps({
  width: {
    type: Number,
  },
  meta: {
    default: () => ({}) as any,
  },
  isMain: {
    type: Boolean,
    default: false,
  },
  no: {
    type: Number,
    required: false,
  },
  useSnapshot: {
    type: Boolean,
    default: false,
  },
  contentStyle: {
    type: Object,
    default: () => ({}),
  },
})

const { isPrintMode } = useNav()

const container = ref<HTMLDivElement | null>(null)
const containerSize = useElementSize(container)
const slideElement = ref<HTMLElement | null>(null)

const isDynamicAspect = computed(() => slideAspect.value === 'dynamic')

const width = computed(() => isDynamicAspect.value ? undefined : (props.width ?? containerSize.width.value))
const height = computed(() => {
  if (isDynamicAspect.value)
    return undefined
  if (props.width && slideAspect.value && typeof slideAspect.value === 'number')
    return props.width / slideAspect.value
  return containerSize.height.value
})

const scale = computed(() => {
  if (isDynamicAspect.value)
    return 1
  if (slideScale.value && !isPrintMode.value)
    return +slideScale.value
  if (width.value !== undefined && height.value !== undefined && typeof slideWidth.value === 'number' && typeof slideHeight.value === 'number')
    return Math.min(width.value / slideWidth.value, height.value / slideHeight.value)
  return 1
})

const contentStyle = computed(() => {
  if (isDynamicAspect.value) {
    return {
      ...props.contentStyle,
      'width': '100%',
      'height': '100%',
      'transform': undefined,
      '--slidev-slide-scale': 1,
    }
  }
  return {
    ...props.contentStyle,
    'height': `${slideHeight.value}px`,
    'width': `${slideWidth.value}px`,
    'transform': `translate(-50%, -50%) scale(${scale.value})`,
    '--slidev-slide-scale': scale.value,
  }
})

const containerStyle = computed(() => {
  if (isDynamicAspect.value)
    return { width: '100%', height: '100%' }
  if (props.width && slideAspect.value && typeof slideAspect.value === 'number') {
    return {
      width: `${props.width}px`,
      height: `${props.width / slideAspect.value}px`,
    }
  }
  return {}
})

if (props.isMain)
  useStyleTag(computed(() => `:root { --slidev-slide-scale: ${scale.value}; }`))

provideLocal(injectionSlideScale, scale)
provideLocal(injectionSlideElement, slideElement)

const snapshot = computed(() => {
  if (props.no == null || !props.useSnapshot)
    return undefined
  return snapshotManager.getSnapshot(props.no, isDark.value)
})
</script>

<template>
  <div
    v-if="!snapshot"
    :id="isMain ? 'slide-container' : undefined"
    ref="container"
    class="slidev-slide-container"
    :style="containerStyle"
    :class="{ 'slidev-dynamic-aspect': isDynamicAspect }"
  >
    <div
      :id="isMain ? 'slide-content' : undefined"
      ref="slideElement"
      class="slidev-slide-content"
      :style="contentStyle"
      :class="{ 'slidev-dynamic-aspect-content': isDynamicAspect }"
    >
      <slot />
    </div>
    <slot name="controls" />
  </div>
  <!-- Image Snapshot -->
  <div v-else class="slidev-slide-container w-full h-full relative">
    <img
      :src="snapshot"
      class="w-full h-full object-cover"
      :style="containerStyle"
    >
    <div absolute bottom-1 right-1 p0.5 text-cyan:75 bg-cyan:10 rounded title="Snapshot">
      <div class="i-carbon-camera" />
    </div>
  </div>
</template>

<style scoped lang="postcss">
.slidev-slide-container {
  @apply relative w-full h-full;
}
.slidev-slide-content {
  @apply bg-main;
}
.slidev-slide-container:not(.slidev-dynamic-aspect) {
  @apply overflow-hidden;
}
.slidev-slide-content:not(.slidev-dynamic-aspect-content) {
  @apply absolute left-1/2 top-1/2 overflow-hidden;
}
.slidev-dynamic-aspect {
  overflow: auto !important;
}
.slidev-dynamic-aspect-content {
  position: relative !important;
  width: 100% !important;
  height: 100% !important;
  overflow: auto !important;
  left: 0 !important;
  top: 0 !important;
  transform: none !important;
}
</style>
