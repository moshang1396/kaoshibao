import { TYPE_MAP } from './types'

// 文本归一化：去首尾空格、忽略大小写、去内部空白、去结尾标点
export function normalizeText(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[。．.，,；;！!？?]+$/g, '')
}

// 判分：客观题返回 true/false，主观题返回 null（待自评）
export function gradeAnswer(question, userAnswer) {
  const t = question.type
  if (t === 'single' || t === 'judge') {
    return typeof userAnswer === 'number' && userAnswer === question.answer[0]
  }
  if (t === 'multi') {
    if (!Array.isArray(userAnswer) || !userAnswer.length) return false
    const a = [...userAnswer].sort().join(',')
    const b = [...question.answer].sort().join(',')
    return a === b
  }
  if (t === 'fill') {
    if (userAnswer == null || String(userAnswer).trim() === '') return false
    const norm = normalizeText(userAnswer)
    return (question.answer || []).some((acc) => normalizeText(acc) === norm)
  }
  return null // 主观题：由用户自评
}

// 用户答案 → 可读文本
export function answerToText(question, userAnswer) {
  if (userAnswer == null) return '未作答'
  const t = question.type
  if (t === 'single' || t === 'judge') {
    return question.options[userAnswer] ?? '未作答'
  }
  if (t === 'multi') {
    if (!Array.isArray(userAnswer) || !userAnswer.length) return '未作答'
    return userAnswer.map((i) => question.options[i]).join('、')
  }
  return String(userAnswer).trim() === '' ? '未作答' : String(userAnswer)
}

// 正确答案 → 可读文本
export function correctAnswerText(question) {
  const t = question.type
  if (t === 'single' || t === 'judge') return question.options[question.answer[0]] ?? '—'
  if (t === 'multi') return question.answer.map((i) => question.options[i]).join('、')
  if (t === 'fill') return (question.answer || []).join(' 或 ')
  return question.answer || '（无参考答案）'
}

export function isObjective(type) {
  return TYPE_MAP[type]?.objective ?? false
}

export function typeLabel(type) {
  return TYPE_MAP[type]?.label ?? type
}
