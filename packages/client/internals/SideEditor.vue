<!-- Bing: should this be called 'SlideEditor'? -->
<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { useNav } from '../composables/useNav'
import { useDynamicSlideInfo } from '../composables/useSlideInfo'
import { activeElement, editorHeight, editorWidth, isInputting, showEditor, isEditorVertical as vertical } from '../state'
import IconButton from './IconButton.vue'
import ShikiEditor from './ShikiEditor.vue'

const props = defineProps<{
  resize?: boolean
}>()

const { currentSlideNo, openInEditor } = useNav()

const tab = ref<'content' | 'note'>('content')
const content = ref('')
const note = ref('')
const dirty = ref(false)

const { info, update } = useDynamicSlideInfo(currentSlideNo)

watch(
  info,
  (v) => {
    if (!isInputting.value) {
      note.value = (v?.note || '').trim()
      const frontmatterPart = v?.frontmatterRaw?.trim() ? `---\n${v.frontmatterRaw.trim()}\n---\n\n` : ''
      content.value = frontmatterPart + (v?.content || '').trim()
      dirty.value = false
    }
  },
  { immediate: true },
)

async function save() {
  dirty.value = false

  let frontmatterRaw: string | undefined
  const contentOnly = content.value.trim().replace(/^---\n([\s\S]*?)\n---\n/, (_, f) => {
    frontmatterRaw = f
    return ''
  })

  await update({
    note: note.value || undefined,
    content: contentOnly,
    frontmatterRaw,
  })
}

function close() {
  showEditor.value = false
}

useEventListener('keydown', (e) => {
  if (activeElement.value?.tagName === 'TEXTAREA' && e.code === 'KeyS' && (e.ctrlKey || e.metaKey)) {
    save()
    e.preventDefault()
  }
})

const contentRef = computed({
  get() { return content.value },
  set(v) {
    if (content.value.trim() !== v.trim())
      dirty.value = true
    content.value = v
  },
})

const noteRef = computed({
  get() { return note.value },
  set(v) {
    note.value = v
    dirty.value = true
  },
})

const handlerDown = ref(false)
// function onHandlerDown() {
//   handlerDown.value = true
// }
function updateSize(v?: number) {
  if (vertical.value)
    editorHeight.value = Math.min(Math.max(300, v ?? editorHeight.value), window.innerHeight - 200)
  else
    editorWidth.value = Math.min(Math.max(318, v ?? editorWidth.value), window.innerWidth - 200)
}
function switchTab(newTab: typeof tab.value) {
  tab.value = newTab
  // @ts-expect-error force cast
  document.activeElement?.blur?.()
}

if (props.resize) {
  useEventListener('pointermove', (e) => {
    if (handlerDown.value) {
      updateSize(vertical.value
        ? window.innerHeight - e.pageY
        : window.innerWidth - e.pageX)
    }
  }, { passive: true })
  useEventListener('pointerup', () => {
    handlerDown.value = false
  })
  useEventListener('resize', () => {
    updateSize()
  })
}
</script>

<template>
  <div
    class="shadow bg-main p-2 pt-4 grid grid-rows-[max-content_1fr] h-full overflow-hidden"
    :class="resize ? 'border-l border-gray-400 border-opacity-20' : ''"
    :style="resize ? {
      height: vertical ? `${editorHeight}px` : undefined,
      width: !vertical ? `${editorWidth}px` : undefined,
    } : {}"
  >
    <div class="editor-header">
      <div class="editor-tabs">
        <div
          class="editor-tab"
          :class="{ active: tab === 'content' }"
          @click="switchTab('content')"
        >
          <div class="tab-icon i-carbon:account" />
          <span>内容</span>
        </div>
        <div
          class="editor-tab"
          :class="{ active: tab === 'note' }"
          @click="switchTab('note')"
        >
          <div class="tab-icon i-carbon:align-box-bottom-right" />
          <span>脚本</span>
        </div>
      </div>
      <div class="editor-header-controls">
        <IconButton v-if="resize" title="贴在右边" @click="vertical = false">
          <div class="i-carbon:open-panel-right" />
        </IconButton>
        <IconButton v-else title="贴在底部" @click="vertical = true">
          <div class="i-carbon:open-panel-bottom" />
        </IconButton>
        <IconButton title="用编辑器打开" @click="openInEditor()">
          <div class="i-carbon:launch" />
        </IconButton>
        <IconButton
          :title="dirty ? '保存' : '无更改可保存'"
          :class="dirty ? 'enabled-button' : 'disabled-button'"
          @click="save"
        >
          <div class="i-carbon:save" />
        </IconButton>
        <IconButton title="关闭" @click="close">
          <div class="i-carbon:close" />
        </IconButton>
      </div>
    </div>
    <div class="relative overflow-hidden rounded" style="background-color: var(--slidev-code-background)">
      <ShikiEditor v-show="tab === 'content'" v-model="contentRef" placeholder="Create slide content..." />
      <ShikiEditor v-show="tab === 'note'" v-model="noteRef" placeholder="Write some notes..." />
    </div>
  </div>
</template>

<style scoped>
/* General Header Styling */
.editor-header {
  display: flex;
  align-items: center;
  padding: 8px;
  background-color: var(--header-background, #f5f5f5);
  border-bottom: 1px solid var(--header-border, #ddd);
}

.editor-tabs {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-grow: 1;
}

.editor-tab {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  background-color: var(--tab-background, #fff);
  /* transition: background-color 0.2s, color 0.2s; */
}

.editor-tab:hover {
  background-color: var(--tab-hover-background, #eaeaea);
}

.editor-tab.active {
  background-color: var(--tab-active-background, #0078d4);
  color: var(--tab-active-color, #fff);
  font-weight: bold;
}

.tab-icon {
  margin-right: 8px;
  font-size: 1.6em; /* Increased icon size */
}

/* Enlarged Icon Buttons */
.editor-header-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.IconButton {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  width: 48px; /* Increased button size */
  height: 48px; /* Increased button size */
  font-size: 1.5em; /* Larger icons */
  border-radius: 50%; /* Circular buttons */
  background-color: var(--icon-button-background, #f5f5f5);
  /* transition: background-color 0.2s, transform 0.1s; */
}

.IconButton:hover {
  background-color: var(--icon-button-hover-background, #eaeaea);
  transform: scale(1.1); /* Slight hover zoom effect */
}

.IconButton:active {
  background-color: var(--icon-button-active-background, #ddd);
  transform: scale(1); /* Reset zoom on click */
}

.enabled-button {
  opacity: 1;
  cursor: pointer;
}

.disabled-button {
  opacity: 0.5;
  pointer-events: none;
  cursor: not-allowed;
}
</style>
