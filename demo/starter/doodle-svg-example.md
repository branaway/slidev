---
layout: center
---

# DoodleSvg Component Examples

Progressive SVG drawing effects for your presentations

---

# Basic Usage:

Load an external SVG file with doodle effect:

<DoodleSvg name='external2' src='/ice-cream-svgrepo-com.svg' :duration="3000" class="w-55 h-30" :debug="false" />


<DoodleSvg name='external' src='/resume.svg' :duration="26000" class="w-100 h-30" />

---

# Inline SVG Example

<DoodleSvg name='inline' :duration="8000" stroke-color="#3b82f6" :stroke-width="1"  :pointer-gap="500">
  <svg viewBox="0 0 200 200" class="w-60 h-60">
    <path d="M20,100 Q100,20 180,100 Q100,180 20,100" fill="none"/>
    <circle cx="100" cy="100" r="30" fill="none"/>
    <path d="M70,80 Q100,60 130,80" fill="none"/>
    <circle cx="85" cy="75" r="3" fill="#ff6b6b"/>
    <circle cx="115" cy="75" r="3" fill="#4ecdc4"/>
  </svg>
</DoodleSvg>

---

# Advanced Options

<script setup>
function onDoodleStart() {
  console.log('Doodle animation started!')
}
function onDoodleComplete() {
  console.log('Doodle animation completed!')
}
</script>

<DoodleSvg
name='advanced'
:duration="4000"
stroke-color="#ef4444"
:stroke-width="2"
:fill-delay="1000"
@start="onDoodleStart"
@complete="onDoodleComplete">

  <svg viewBox="0 0 300 200" class="w-80 h-60">
    <rect x="50" y="50" width="100" height="60" fill="#fbbf24"/>
    <circle cx="200" cy="80" r="40" fill="#10b981"/>
    <path d="M50,150 L150,120 L250,150 L200,180 L100,180 Z" fill="#8b5cf6"/>
  </svg>
</DoodleSvg>

---

# Manual Control

<script setup>
import { ref } from 'vue'

const doodleRef = ref()
const triggerAnimation = ref(false)

function startAnimation() {
  triggerAnimation.value = !triggerAnimation.value
}

function resetAnimation() {
  doodleRef.value?.reset()
}
</script>

<div class="flex gap-4 mb-8">
  <button @click="startAnimation" class="px-4 py-2 bg-blue-500 text-white rounded">
    Trigger Animation
  </button>
  <button @click="resetAnimation" class="px-4 py-2 bg-gray-500 text-white rounded">
    Reset
  </button>
</div>

<DoodleSvg name='manual' ref="doodleRef" :trigger="triggerAnimation" :autoplay="false" :duration="3000" stroke-color="#ec4899">
  <svg viewBox="0 0 300 150" class="w-80 h-40">
    <path d="M50,75 Q150,25 250,75 Q150,125 50,75" fill="none"/>
    <text x="150" y="85" text-anchor="middle" font-size="20" fill="currentColor">Hello!</text>
  </svg>
</DoodleSvg>

---

# Integration with v-click!!

<v-click>

<DoodleSvg name='v-click' :duration="2000" stroke-color="#059669" debug='true'>
  <svg viewBox="0 0 200 100" class="w-60 h-30">
    <path d="M20,50 L180,50" fill="none"/>
    <path d="M170,40 L180,50 L170,60" fill="none"/>
  </svg>
</DoodleSvg>

</v-click>

<v-click>

## Perfect for step-by-step reveals!

</v-click>

---

# Two Doodles Example

You can embed multiple DoodleSvg components on the same page. Each will animate independently.

<div class="flex gap-8 items-center justify-center">
  <DoodleSvg name="doodle1" :duration="2500" stroke-color="#6366f1" :stroke-width="2">
    <svg viewBox="0 0 100 100" class="w-40 h-40">
      <circle cx="50" cy="50" r="40" fill="none" />
      <path d="M10,90 Q50,10 90,90" fill="none" />
    </svg>
  </DoodleSvg>

  <DoodleSvg name="doodle2" :duration="1800" stroke-color="#f59e42" :stroke-width="2">
    <svg viewBox="0 0 100 100" class="w-40 h-40">
      <rect x="20" y="20" width="60" height="60" fill="none" />
      <path d="M20,80 L80,20" fill="none" />
    </svg>
  </DoodleSvg>
</div>

---
