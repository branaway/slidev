<script setup lang="ts">
import CustomNavControls from '#slidev/custom-nav-controls'
import { computed, ref, shallowRef } from 'vue'
import { useDrawings } from '../composables/useDrawings'
import { useNav } from '../composables/useNav'
import { configs } from '../env'
import { isColorSchemaConfigured, isDark, toggleDark } from '../logic/dark'
import { activeElement, breakpoints, fullscreen, presenterLayout, showEditor, showInfoDialog, showPresenterCursor, toggleOverview, togglePresenterLayout } from '../state'
import { downloadPDF } from '../utils'
import IconButton from './IconButton.vue'
import MenuButton from './MenuButton.vue'
import Settings from './Settings.vue'

import VerticalDivider from './VerticalDivider.vue'

const props = defineProps({
  persist: {
    default: false,
  },
})

const {
  currentSlideNo,
  hasNext,
  hasPrev,
  isEmbedded,
  isPresenter,
  isPresenterAvailable,
  next,
  prev,
  total,
  enterPresenter,
  exitPresenter,
} = useNav()
const {
  brush,
  drawingEnabled,
} = useDrawings()

const md = breakpoints.smaller('md')
const { isFullscreen, toggle: toggleFullscreen } = fullscreen

const root = ref<HTMLDivElement>()
function onMouseLeave() {
  if (root.value && activeElement.value && root.value.contains(activeElement.value))
    activeElement.value.blur()
}

const barStyle = computed(() => props.persist
  ? 'text-$slidev-controls-foreground bg-transparent'
  : 'rounded-md bg-main shadow-xl dark:border dark:border-main')

const RecordingControls = shallowRef<any>()
if (__SLIDEV_FEATURE_RECORD__)
  import('./RecordingControls.vue').then(v => RecordingControls.value = v.default)
</script>

<template>
  <nav ref="root" class="flex flex-col">
    <div
      class="flex flex-wrap text-xl gap-0.5 p-1 lg:p-2"
      :class="barStyle"
      @mouseleave="onMouseLeave"
    >
      <IconButton v-if="!isEmbedded" :title="isFullscreen ? '关闭全屏' : ''" @click="toggleFullscreen">
        <div v-if="isFullscreen" class="i-carbon:minimize" />
        <div v-else class="i-carbon:maximize" />
      </IconButton>
      <IconButton :class="{ disabled: !hasPrev }" title="之前" @click="prev">
        <div class="i-carbon:arrow-left" />
      </IconButton>
      <IconButton :class="{ disabled: !hasNext }" title="之后" @click="next">
        <div class="i-carbon:arrow-right" />
      </IconButton>
      <IconButton v-if="!isEmbedded" title="演示大纲" @click="toggleOverview()">
        <div class="i-carbon:apps" />
      </IconButton>
      <IconButton
        v-if="!isColorSchemaConfigured"
        :title="isDark ? '用明亮模式' : '用暗黑模式'"
        @click="toggleDark()"
      >
        <carbon-moon v-if="isDark" />
        <carbon-sun v-else />
      </IconButton>

      <VerticalDivider />

      <template v-if="!isEmbedded">
        <template v-if="!isPresenter && !md && RecordingControls">
          <RecordingControls />
          <VerticalDivider />
        </template>

        <IconButton
          v-if="isPresenter"
          :title="showPresenterCursor ? '隐藏演讲者光标' : '显示演讲者光标'"
          @click="showPresenterCursor = !showPresenterCursor"
        >
          <ph-cursor-fill v-if="showPresenterCursor" />
          <ph-cursor-duotone v-else />
        </IconButton>
      </template>

      <template v-if="__SLIDEV_FEATURE_DRAWINGS__ && (!configs.drawings.presenterOnly || isPresenter) && !isEmbedded">
        <IconButton class="relative" :title="drawingEnabled ? '隐藏画图工具' : '显示画图工具'" @click="drawingEnabled = !drawingEnabled">
          <div class="i-carbon:pen" />
          <div
            v-if="drawingEnabled"
            class="absolute left-1 right-1 bottom-0 h-0.7 rounded-full"
            :style="{ background: brush.color }"
          />
        </IconButton>
        <VerticalDivider />
      </template>

      <template v-if="!isEmbedded">
        <IconButton v-if="isPresenter" title="播放模式" @click="exitPresenter">
          <div class="i-carbon:presentation-file" />
        </IconButton>
        <IconButton v-if="__SLIDEV_FEATURE_PRESENTER__ && isPresenterAvailable" title="演讲者模式" @click="enterPresenter">
          <div class="i-carbon:user-speaker" />
        </IconButton>

        <IconButton
          v-if="__DEV__ && __SLIDEV_FEATURE_EDITOR__"
          :title="showEditor ? '隐藏编辑器' : '显示编辑器'"
          class="lt-md:hidden"
          @click="showEditor = !showEditor"
        >
          <div class="i-carbon:text-annotation-toggle" />
        </IconButton>

        <IconButton v-if="isPresenter" title="切换演讲者布局" class="aspect-ratio-initial flex items-center" @click="togglePresenterLayout">
          <div class="i-carbon:template" />
          {{ presenterLayout }}
        </IconButton>
      </template>
      <template v-if="!__DEV__">
        <IconButton v-if="configs.download" title="下载PDF" @click="downloadPDF">
          <div class="i-carbon:download" />
        </IconButton>
      </template>

      <template v-if="__SLIDEV_FEATURE_BROWSER_EXPORTER__">
        <IconButton title="浏览器输出" to="/export">
          <div class="i-carbon:document-pdf" />
        </IconButton>
      </template>
      <!--

    -->

      <IconButton
        v-if="!isPresenter && configs.info && !isEmbedded"
        title="关于"
        @click="showInfoDialog = !showInfoDialog"
      >
        <div class="i-carbon:information" />
      </IconButton>

      <template v-if="!isPresenter && !isEmbedded">
        <MenuButton>
          <template #button>
            <IconButton title="更多选项">
              <div class="i-carbon:settings-adjust" />
            </IconButton>
          </template>
          <template #menu>
            <Settings />
          </template>
        </MenuButton>
      </template>
      <VerticalDivider v-if="!isEmbedded" />

      <div p="l-1 t-2 r-2" text="sm leading-2">
        {{ currentSlideNo }}<span class="opacity-50"> / {{ total }}</span>
      </div>
      <!--
 -->
      <CustomNavControls />
    </div>
  </nav>
</template>
