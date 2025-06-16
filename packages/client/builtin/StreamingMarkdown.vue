<!--
Streaming Markdown Renderer
Renders markdown content with a streaming effect

Usage:
<StreamingMarkdown :content="markdownContent" :speed="20" />
-->

<script setup lang="ts">
import Markdown from 'markdown-it'
import { ref, watch } from 'vue'
import { useSlideContext } from '../context'

const props = defineProps<{
  content: string
  speed?: number
}>()

const { $clicksContext: clicks } = useSlideContext()
const renderedContent = ref('')
const currentIndex = ref(0)
const isStreaming = ref(true)

const md = new Markdown({
  html: true,
  linkify: true,
  typographer: true,
})

function streamContent() {
  if (currentIndex.value >= props.content.length) {
    isStreaming.value = false
    return
  }

  // Get the current character
  const currentChar = props.content[currentIndex.value]

  // If we encounter a '<', find the complete HTML tag
  if (currentChar === '<') {
    let tagEnd = currentIndex.value
    let inTag = true

    // Find the end of the HTML tag
    while (tagEnd < props.content.length && inTag) {
      if (props.content[tagEnd] === '>') {
        inTag = false
      }
      tagEnd++
    }

    // Jump to the end of the tag
    currentIndex.value = tagEnd
  }
  else {
    // Normal character-by-character streaming
    currentIndex.value++
  }

  const chunk = props.content.slice(0, currentIndex.value)
  renderedContent.value = md.render(chunk)

  if (isStreaming.value) {
    setTimeout(streamContent, props.speed || 20)
  }
}

watch(() => props.content, () => {
  currentIndex.value = 0
  isStreaming.value = true
  streamContent()
}, { immediate: true })

// Pause streaming when slide is not active
watch(() => clicks?.current.value, (current) => {
  if (current === undefined)
    return
  isStreaming.value = current === clicks?.current.value
  if (isStreaming.value) {
    streamContent()
  }
})
</script>

<template>
  <div class="streaming-markdown" :class="{ 'is-streaming': isStreaming }" v-html="renderedContent" />
</template>

<style>
.streaming-markdown {
  position: relative;
}

.streaming-markdown.is-streaming::after {
  content: '▋';
  position: absolute;
  animation: blink 1s infinite;
  margin-left: 2px;
}

@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}
</style>
