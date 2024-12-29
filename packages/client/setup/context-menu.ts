/// <reference types="unplugin-icons/types/vue3" />

import type { ContextMenuItem } from '@slidev/types'
import type { ComputedRef } from 'vue'
import setups from '#slidev/setups/context-menu'
import { computed } from 'vue'
import { useDrawings } from '../composables/useDrawings'
import { useNav } from '../composables/useNav'
import { fullscreen, showEditor, toggleOverview } from '../state'

// @unocss-include

let items: ComputedRef<ContextMenuItem[]> | undefined

export default () => {
  if (items)
    return items

  const {
    next,
    nextSlide,
    prev,
    prevSlide,
    hasNext,
    hasPrev,
    currentPage,
    total,
    isPresenter,
    enterPresenter,
    exitPresenter,
    isEmbedded,
    isPresenterAvailable,
  } = useNav()
  const { drawingEnabled } = useDrawings()
  const {
    isFullscreen,
    toggle: toggleFullscreen,
  } = fullscreen

  return items = setups.reduce(
    (items, fn) => fn(items),
    computed(() => [
      {
        small: true,
        icon: 'i-carbon:arrow-left',
        label: '之前',
        action: prev,
        disabled: !hasPrev.value,
      },
      {
        small: true,
        icon: 'i-carbon:arrow-right',
        label: '之后',
        action: next,
        disabled: !hasNext.value,
      },
      {
        small: true,
        icon: 'i-carbon:arrow-up',
        label: '前页',
        action: prevSlide,
        disabled: currentPage.value <= 1,
      },
      {
        small: true,
        icon: 'i-carbon:arrow-down',
        label: '后页',
        action: nextSlide,
        disabled: currentPage.value >= total.value,
      },
      'separator',
      {
        icon: 'i-carbon:text-annotation-toggle', // IconTextNotationToggle,
        label: showEditor.value ? '掩藏编辑器' : '显示编辑器',
        action: () => (showEditor.value = !showEditor.value),
      },
      {
        icon: 'i-carbon:pen',
        label: drawingEnabled.value ? '隐藏图画板' : '显示图画板',
        action: () => (drawingEnabled.value = !drawingEnabled.value),
      },
      {
        icon: 'i-carbon:apps',
        label: '显示幻灯片要览',
        action: toggleOverview,
      },
      isPresenter.value && {
        icon: 'i-carbon:presentation-file',
        label: '退出演讲者模式',
        action: exitPresenter,
      },
      __SLIDEV_FEATURE_PRESENTER__ && isPresenterAvailable.value && {
        icon: 'i-carbon:user-speaker',
        label: '进入演讲者模式',
        action: enterPresenter,
      },
      !isEmbedded.value && {
        icon: isFullscreen.value ? 'i-carbon:minimize' : 'i-carbon:maximize',
        label: isFullscreen.value ? '关闭全屏' : '进入全屏',
        action: toggleFullscreen,
      },
    ].filter(Boolean) as ContextMenuItem[]),
  )
}
