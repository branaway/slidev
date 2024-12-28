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
    <div class="flex pb-2 text-xl -mt-1">
      <div class="mr-4 rounded flex">
        <IconButton
          title="内容" :class="tab === 'content' ? 'text-primary' : ''"
          @click="switchTab('content')"
        >
          <div class="i-carbon:account" />
        </IconButton>
        <IconButton
          title="脚本" :class="tab === 'note' ? 'text-primary' : ''"
          @click="switchTab('note')"
        >
          <div class="i-carbon:align-box-bottom-right" />
        </IconButton>
      </div>
      <span class="text-2xl pt-1">
        {{ tab === 'content' ? '内容' : '脚本' }}
      </span>
      <div class="flex-auto" />
      <template v-if="resize">
        <IconButton v-if="vertical" title="贴在右边" @click="vertical = false">
          <div class="i-carbon:open-panel-right" />
        </IconButton>
        <IconButton v-else title="贴在底部" @click="vertical = true">
          <div class="i-carbon:open-panel-bottom" />
        </IconButton>
      </template>
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
    <div class="relative overflow-hidden rounded" style="background-color: var(--slidev-code-background)">
      <ShikiEditor v-show="tab === 'content'" v-model="contentRef" placeholder="Create slide content..." />
      <ShikiEditor v-show="tab === 'note'" v-model="noteRef" placeholder="Write some notes..." />
    </div>
  </div>
</template>

<style scoped>
.disabled-button {
  opacity: 0.5;
  pointer-events: none;
  cursor: not-allowed;
}

.enabled-button {
  opacity: 1;
  cursor: pointer;
}

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
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  background-color: var(--tab-background, #fff);
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
  font-size: 1.2em;
}

.editor-header-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
