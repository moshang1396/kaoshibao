<script setup>
// 统一的答题输入组件：
// - practice 模式：单选/判断点击即提交；多选/填空/主观题带确认按钮，emit('submit', answer)
// - exam 模式：所有题型仅作选择/填写，emit('update:modelValue', answer)
// - locked（练习提交后）：显示对错高亮，不再可交互
import { computed } from 'vue'
import { OPTION_LETTERS } from '../utils/types'

const props = defineProps({
  q: { type: Object, required: true },
  modelValue: { default: null },
  mode: { type: String, default: 'practice' }, // practice | exam
  locked: { type: Boolean, default: false },
  isCorrect: { type: [Boolean, null], default: null },
  confirmText: { type: String, default: '确认答案' }
})
const emit = defineEmits(['update:modelValue', 'submit'])

const isPractice = computed(() => props.mode === 'practice')

const type = computed(() => props.q.type)
const isChoice = computed(() => ['single', 'multi', 'judge'].includes(type.value))
const isMulti = computed(() => type.value === 'multi')
const isFill = computed(() => type.value === 'fill')
const isSubjective = computed(() => ['short', 'apply', 'draw'].includes(type.value))

const userAnswer = computed(() => props.modelValue)

// 客观题：判断某个选项的状态
function optState(i) {
  if (!props.locked) {
    // 未提交：仅显示选中态
    if (isMulti.value) return Array.isArray(userAnswer.value) && userAnswer.value.includes(i) ? 'selected' : ''
    if (isChoice.value) return userAnswer.value === i ? 'selected' : ''
    return ''
  }
  // 已提交：显示对错
  const correctSet = Array.isArray(props.q.answer) ? props.q.answer : []
  const isCorrectOpt = correctSet.includes(i)
  const userSet = isMulti.value
    ? (Array.isArray(userAnswer.value) ? userAnswer.value : [])
    : (userAnswer.value != null ? [userAnswer.value] : [])
  const isUserPick = userSet.includes(i)
  if (isCorrectOpt) return 'correct'
  if (isUserPick && !props.isCorrect) return 'wrong'
  return ''
}

// ===== 单选 / 判断 =====
function clickOption(i) {
  if (props.locked) return
  if (isMulti.value) {
    const cur = Array.isArray(props.modelValue) ? [...props.modelValue] : []
    const idx = cur.indexOf(i)
    if (idx >= 0) cur.splice(idx, 1)
    else cur.push(i)
    emit('update:modelValue', cur)
  } else if (isPractice.value) {
    // 练习模式：点击即提交
    emit('update:modelValue', i)
    emit('submit', i)
  } else {
    // 考试模式：选择 / 再点取消
    emit('update:modelValue', props.modelValue === i ? null : i)
  }
}

const multiReady = computed(() => Array.isArray(props.modelValue) && props.modelValue.length > 0)
const fillReady = computed(() => String(props.modelValue ?? '').trim() !== '')

function confirmMulti() {
  if (!multiReady.value) return
  emit('submit', [...props.modelValue].sort((a, b) => a - b))
}
function confirmFill() {
  if (!fillReady.value) return
  emit('submit', String(props.modelValue).trim())
}
function confirmSubjective() {
  emit('submit', String(props.modelValue ?? '').trim())
}

function onTextInput(e) {
  emit('update:modelValue', e.target.value)
}

// 填空题已提交后的对错着色
const fillClass = computed(() => {
  if (!props.locked) return ''
  if (props.isCorrect === true) return 'alert ok'
  if (props.isCorrect === false) return 'alert err'
  return ''
})

const fillInputBorder = computed(() => {
  if (!props.locked) return {}
  if (props.isCorrect === true) return { borderColor: 'var(--green)', background: 'var(--green-weak)' }
  if (props.isCorrect === false) return { borderColor: 'var(--red)', background: 'var(--red-weak)' }
  return {}
})
</script>

<template>
  <div>
    <!-- 选择 / 判断 -->
    <div v-if="isChoice">
      <button
        v-for="(opt, i) in q.options"
        :key="i"
        class="opt"
        :class="[optState(i), { disabled: locked, 'judge-opt': type === 'judge' }]"
        @click="clickOption(i)"
      >
        <span v-if="type !== 'judge'" class="letter">{{ OPTION_LETTERS[i] }}</span>
        <span>{{ opt }}</span>
      </button>
      <div v-if="isMulti && isPractice && !locked" class="row mt">
        <button class="btn primary" :disabled="!multiReady" @click="confirmMulti">{{ confirmText }}</button>
        <span v-if="!multiReady" class="muted small">请至少选择一项</span>
      </div>
    </div>

    <!-- 填空 -->
    <div v-else-if="isFill">
      <input
        type="text"
        class="fill-input"
        style="width: 100%; font-size: 15px"
        :style="fillInputBorder"
        :value="modelValue ?? ''"
        :disabled="locked"
        placeholder="请输入答案…"
        @input="onTextInput"
        @keydown.enter="!locked && confirmFill()"
      />
      <div v-if="isPractice && !locked" class="row mt">
        <button class="btn primary" :disabled="!fillReady" @click="confirmFill">{{ confirmText }}</button>
      </div>
    </div>

    <!-- 简答 / 应用 / 画图 -->
    <div v-else>
      <textarea
        :rows="type === 'draw' ? 6 : 4"
        :value="modelValue ?? ''"
        :disabled="locked"
        placeholder="请输入你的作答（画图题可描述画法或思路）…"
        @input="onTextInput"
      ></textarea>
      <div v-if="isPractice && !locked" class="row mt">
        <button class="btn primary" @click="confirmSubjective">提交，查看参考答案</button>
      </div>
    </div>
  </div>
</template>
