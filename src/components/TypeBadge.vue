<script setup>
import { computed } from 'vue'
import { TYPE_MAP } from '../utils/types'

const props = defineProps({ type: String })
const label = computed(() => TYPE_MAP[props.type]?.label ?? props.type)
</script>

<template>
  <span class="chip" :class="'t-' + type">{{ label }}</span>
</template>
