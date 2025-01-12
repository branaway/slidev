<script setup lang="ts">
import { useStyleTag } from '@vueuse/core'
import { computed, ref, shallowRef } from 'vue'
// import { useDrawings } from '../composables/useDrawings'
import { useHideCursorIdle } from '../composables/useHideCursorIdle'
import { useNav } from '../composables/useNav'
import { useSwipeControls } from '../composables/useSwipeControls'
import { useWakeLock } from '../composables/useWakeLock'
import Controls from '../internals/Controls.vue'
import NavControls from '../internals/NavControls.vue'
import PresenterMouse from '../internals/PresenterMouse.vue'
import SlideContainer from '../internals/SlideContainer.vue'
import SlidesShow from '../internals/SlidesShow.vue'
// import { onContextMenu } from '../logic/contextMenu'
import { registerShortcuts } from '../logic/shortcuts'
// import { editorHeight, editorWidth, isEditorVertical, isScreenVertical, showEditor, viewerCssFilter, viewerCssFilterDefaults } from '../state'
import { editorHeight, editorWidth, isEditorVertical, showEditor } from '../state'

const { next, prev, isPrintMode, isPresenter } = useNav()
// const { isDrawing } = useDrawings()

const root = ref<HTMLDivElement>()
function onClick(e: MouseEvent) {
  if (showEditor.value)
    return

  if (e.button === 0 && (e.target as HTMLElement)?.id === 'slide-container') {
    // click right to next, left to previous
    if ((e.pageX / window.innerWidth) > 0.5)
      next()
    else
      prev()
  }
}

useSwipeControls(root)
registerShortcuts()
if (__SLIDEV_FEATURE_WAKE_LOCK__)
  useWakeLock()
useHideCursorIdle(computed(() => !isPresenter.value && !isPrintMode.value))

if (import.meta.hot) {
  useStyleTag(computed(() => showEditor.value
    ? `
    vite-error-overlay {
      --width: calc(100vw - ${isEditorVertical.value ? 0 : editorWidth.value}px);
      --height: calc(100vh - ${isEditorVertical.value ? editorHeight.value : 0}px);
      position: fixed;
      left: 0;
      top: 0;
      width: calc(var(--width) / var(--slidev-slide-scale));
      height: calc(var(--height) / var(--slidev-slide-scale));
      transform-origin: top left;
      transform: scale(var(--slidev-slide-scale));
    }`
    : '',
  ))
}

// const persistNav = computed(() => isScreenVertical.value || showEditor.value)

const SideEditor = shallowRef<any>()
if (__DEV__ && __SLIDEV_FEATURE_EDITOR__)
  import('../internals/SideEditor.vue').then(v => SideEditor.value = v.default)

// const contentStyle = computed(() => {
//   let filter = ''

//   if (viewerCssFilter.value.brightness !== viewerCssFilterDefaults.brightness)
//     filter += `brightness(${viewerCssFilter.value.brightness}) `
//   if (viewerCssFilter.value.contrast !== viewerCssFilterDefaults.contrast)
//     filter += `contrast(${viewerCssFilter.value.contrast}) `
//   if (viewerCssFilter.value.sepia !== viewerCssFilterDefaults.sepia)
//     filter += `sepia(${viewerCssFilter.value.sepia}) `
//   if (viewerCssFilter.value.hueRotate !== viewerCssFilterDefaults.hueRotate)
//     filter += `hue-rotate(${viewerCssFilter.value.hueRotate}deg) `
//   if (viewerCssFilter.value.invert)
//     filter += 'invert(1) '

//   return {
//     filter,
//   }
// })

function startDragging(event: MouseEvent) {
  const startPos = isEditorVertical.value ? event.clientY : event.clientX
  const startSize = isEditorVertical.value ? editorHeight.value : editorWidth.value

  function onMove(event: MouseEvent) {
    // const delta = (window.innerWidth - event.clientX) - startPos
    const delta = isEditorVertical.value
      ? event.clientY - startPos
      : event.clientX - startPos

    if (isEditorVertical.value) {
      editorHeight.value = Math.min(
        Math.max(50, startSize - delta),
        window.innerHeight - 50,
      )
    }
    else {
      editorWidth.value = Math.min(
        Math.max(50, startSize - delta),
        window.innerWidth - 50,
      )
    }
  }

  function onUp() {
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }

  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}
</script>

<template>
  <div
    id="page-root"
    ref="root"
    class="grid w-full h-full"
    :class="[
      isEditorVertical
        ? showEditor
          ? 'grid-rows-[1fr_auto_auto] grid-cols-[1fr]'
          : 'grid-rows-[1fr] grid-cols-[1fr]'
        : showEditor
          ? 'grid-cols-[1fr_auto_auto] grid-rows-[1fr]'
          : 'grid-cols-[1fr] grid-rows-[1fr]',
    ]"
  >
    <!-- Slide Container -->
    <SlideContainer
      class="col-start-1 row-start-1"
      :style="{ background: 'var(--slidev-slide-container-background, black)' }"
      is-main
      @pointerdown="onClick"
    >
      <template #default>
        <SlidesShow render-context="slide" />
        <PresenterMouse />
      </template>
      <template #controls>
        <div
          v-if="!isPrintMode"
          class="absolute bottom-0 left-1/2 transform -translate-x-1/2
                transition duration-300 opacity-0 hover:opacity-100
                focus-within:opacity-100 focus-visible:opacity-100"
        >
          <NavControls />
        </div>
      </template>
    </SlideContainer>

    <!-- Draggable Divider (shows only if editor is visible or you want it always visible) -->
    <div
      v-if="SideEditor && showEditor"
      class="cursor-col-resize hover:bg-gray-400/10 active:bg-gray-400/20 transition-colors"
      :class="[
        isEditorVertical
          ? 'row-start-2 row-span-1 h-2 w-full cursor-row-resize'
          : 'col-start-2 col-span-1 w-2 h-full',
      ]"
      @mousedown="startDragging"
    />

    <!-- Side Editor -->
    <SideEditor
      v-if="SideEditor && showEditor"
      :resize="true"
      :class="[
        // put the editor in the 3rd column if horizontal,
        // or row 3 if vertical
        isEditorVertical
          ? 'row-start-3 row-span-1'
          : 'col-start-3 col-span-1',
      ]"
      style="background: #fefefe;"
    />
  </div>

  <!-- Extra Controls if needed -->
  <Controls v-if="!isPrintMode" />
  <div id="twoslash-container" />
</template>
