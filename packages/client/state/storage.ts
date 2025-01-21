import type { DragElementState } from '../composables/useDragElements'
import { useLocalStorage as baseUseLocalStorage, breakpointsTailwind, isClient, useActiveElement, useBreakpoints, useFullscreen, useMagicKeys, useToggle, useWindowSize } from '@vueuse/core'
import { computed, ref, shallowRef } from 'vue'
import { AppConfig, slideAspect } from '../env'

export const showRecordingDialog = ref(false)
export const showInfoDialog = ref(false)
export const showGotoDialog = ref(false)
export const showOverview = ref(false)

/**
 * Skip slides transition when triggered by HMR.
 * Will reset automatically after user navigations
 */
export const hmrSkipTransition = ref(false)
export const disableTransition = ref(false)

export const shortcutsEnabled = ref(true)
export const breakpoints = useBreakpoints({
  xs: 460,
  ...breakpointsTailwind,
})
export const windowSize = useWindowSize()
export const magicKeys = useMagicKeys()
export const isScreenVertical = computed(() => windowSize.height.value - windowSize.width.value / slideAspect.value > 120)
export const fullscreen = useFullscreen(isClient ? document.body : null)

export const activeElement = useActiveElement()
export const isInputting = computed(() => ['INPUT', 'TEXTAREA'].includes(activeElement.value?.tagName || ''))
export const isOnFocus = computed(() => ['BUTTON', 'A'].includes(activeElement.value?.tagName || ''))

export const currentCamera = useLocalStorageWithBase<string>('slidev-camera', 'default', { listenToStorageChanges: false })
export const currentMic = useLocalStorageWithBase<string>('slidev-mic', 'default', { listenToStorageChanges: false })
export const slideScale = useLocalStorageWithBase<number>('slidev-scale', 0)
export const wakeLockEnabled = useLocalStorageWithBase('slidev-wake-lock', true)
export const hideCursorIdle = useLocalStorageWithBase('slidev-hide-cursor-idle', true)
export const skipExportPdfTip = useLocalStorageWithBase('slidev-skip-export-pdf-tip', false)
export const captureDelay = useLocalStorageWithBase('slidev-export-capture-delay', 400, { listenToStorageChanges: false })

export const showPresenterCursor = useLocalStorageWithBase('slidev-presenter-cursor', true, { listenToStorageChanges: false })
export const showEditor = useLocalStorageWithBase('slidev-show-editor', false, { listenToStorageChanges: false })
export const isEditorVertical = useLocalStorageWithBase('slidev-editor-vertical', false, { listenToStorageChanges: false })
export const editorWidth = useLocalStorageWithBase('slidev-editor-width', isClient ? window.innerWidth * 0.4 : 318, { listenToStorageChanges: false })
export const editorHeight = useLocalStorageWithBase('slidev-editor-height', isClient ? window.innerHeight * 0.4 : 300, { listenToStorageChanges: false })

export const activeDragElement = shallowRef<DragElementState | null>(null)

export const presenterNotesFontSize = useLocalStorageWithBase('slidev-presenter-font-size', 1, { listenToStorageChanges: false })
export const presenterLayout = useLocalStorageWithBase('slidev-presenter-layout', 1, { listenToStorageChanges: false })

export const viewerCssFilterDefaults = {
  invert: false,
  contrast: 1,
  brightness: 1,
  hueRotate: 0,
  saturate: 1,
  sepia: 0,
}
export const viewerCssFilter = useLocalStorageWithBase(
  'slidev-viewer-css-filter',
  viewerCssFilterDefaults,
  { listenToStorageChanges: false, mergeDefaults: true, deep: true },
)
export const hasViewerCssFilter = computed(() => {
  return (Object.keys(viewerCssFilterDefaults) as (keyof typeof viewerCssFilterDefaults)[])
    .some(k => viewerCssFilter.value[k] !== viewerCssFilterDefaults[k])
})

export function togglePresenterLayout() {
  presenterLayout.value = presenterLayout.value + 1
  if (presenterLayout.value > 3)
    presenterLayout.value = 1
}

export function increasePresenterFontSize() {
  presenterNotesFontSize.value = Math.min(2, presenterNotesFontSize.value + 0.1)
}

export function decreasePresenterFontSize() {
  presenterNotesFontSize.value = Math.max(0.5, presenterNotesFontSize.value - 0.1)
}

export const toggleOverview = useToggle(showOverview)

export const syncDirections = useLocalStorageWithBase(
  'slidev-sync-directions',
  {
    viewerSend: true,
    viewerReceive: true,
    presenterSend: true,
    presenterReceive: true,
  },
  {
    listenToStorageChanges: false,
    mergeDefaults: true,
  },
)

/**
 * LocalStorage with Base URL prefix.
 * @param key The localStorage key.
 * @param defaultValue The default value.
 * @param options Options for useLocalStorage.
 */
export function useLocalStorageWithBase<T>(key: string, defaultValue: T, options = {}) {
  const namespacedKey = `${AppConfig.base}:${key}`
  return baseUseLocalStorage<T>(namespacedKey, defaultValue, options)
}
