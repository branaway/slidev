<script setup lang="ts">
import type { SelectionItem } from './types'
import { computed } from 'vue'
import {
  cameras,
  ensureDevicesListPermissions,
  microphones,
  mimeExtMap,
  mimeType,
  supportedMimeTypes,
} from '../logic/recording'
import { currentCamera, currentMic } from '../state'
import SelectList from './SelectList.vue'

const camerasItems = computed<SelectionItem<string>[]>(() => [
  {
    value: 'none',
    display: 'None',
  },
  ...cameras.value.map(i => ({
    value: i.deviceId,
    display: i.label,
  })),
])

const microphonesItems = computed<SelectionItem<string>[]>(() => [
  {
    value: 'none',
    display: 'None',
  },
  ...microphones.value.map(i => ({
    value: i.deviceId,
    display: i.label,
  })),
])

const mimeTypeItems = supportedMimeTypes.map(mime => ({
  value: mime,
  display: mimeExtMap[mime].toUpperCase(),
}))

ensureDevicesListPermissions()
</script>

<template>
  <div class="text-sm">
    <SelectList v-model="currentCamera" title="摄像头" :items="camerasItems" />
    <SelectList v-model="currentMic" title="麦克风" :items="microphonesItems" />
    <SelectList
      v-if="mimeTypeItems.length"
      v-model="mimeType"
      title="视频格式"
      :items="mimeTypeItems"
    />
  </div>
</template>
