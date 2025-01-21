<script setup lang="ts">
import { useDraggable } from '@vueuse/core'
import { ref } from 'vue'
import { useLocalStorageWithBase } from '../state'

const props = defineProps<{
  storageKey?: string
  initial?: { x: number, y: number }
}>()

const el = ref<HTMLElement | null>(null)
const initial = props.initial ?? { x: 0, y: 0 }
const point = props.storageKey
  ? useLocalStorageWithBase(props.storageKey, initial)
  : ref(initial)
const { style } = useDraggable(el, { initialValue: point })
</script>

<template>
  <div ref="el" class="fixed" :style="style">
    <slot />
  </div>
</template>
