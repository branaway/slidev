<script setup lang="ts">
import type { SelectionItem } from './types'
import { useWakeLock } from '@vueuse/core'
import { slideScale, wakeLockEnabled } from '../state'
import SelectList from './SelectList.vue'

const scaleItems: SelectionItem<number>[] = [
  {
    display: '适应',
    value: 0,
  },
  {
    display: '1:1',
    value: 1,
  },
]

const { isSupported } = useWakeLock()

const wakeLockItems: SelectionItem<boolean>[] = [
  {
    display: '打开',
    value: true,
  },
  {
    display: '关闭',
    value: false,
  },
]
</script>

<template>
  <div class="text-sm select-none mb-2">
    <SelectList v-model="slideScale" title="缩放" :items="scaleItems" />
    <SelectList
      v-if="__SLIDEV_FEATURE_WAKE_LOCK__ && isSupported"
      v-model="wakeLockEnabled" title="不进入休眠" :items="wakeLockItems"
    />
  </div>
</template>
