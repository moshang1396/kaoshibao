<script setup>
import { computed } from 'vue'

const props = defineProps({
  label: String,
  percent: { type: Number, default: 0 },
  detail: String
})
const width = computed(() => Math.max(0, Math.min(100, props.percent)) + '%')
</script>

<template>
  <div class="bar-row">
    <div class="name">{{ label }}</div>
    <div class="track"><div class="fill" :style="{ width }"></div></div>
    <div class="val">{{ detail }}</div>
  </div>
</template>
