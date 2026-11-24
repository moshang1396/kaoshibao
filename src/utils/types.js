// 题型定义与解析
export const QUESTION_TYPES = [
  { key: 'single', label: '单选题', short: '单选', objective: true },
  { key: 'multi', label: '多选题', short: '多选', objective: true },
  { key: 'judge', label: '判断题', short: '判断', objective: true },
  { key: 'fill', label: '填空题', short: '填空', objective: true },
  { key: 'short', label: '简答题', short: '简答', objective: false },
  { key: 'apply', label: '应用题', short: '应用', objective: false },
  { key: 'draw', label: '画图题', short: '画图', objective: false }
]

export const TYPE_MAP = Object.fromEntries(QUESTION_TYPES.map((t) => [t.key, t]))

export const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

// 题型中文 → key（宽容匹配：单选题/单选/xuanze 等）
export function normalizeType(raw) {
  if (!raw) return null
  const s = String(raw).trim().toLowerCase().replace(/\s+/g, '')
  if (!s) return null
  if (/(^单选)|(single)|(radio)/.test(s)) return 'single'
  if (/(^多选)|(multi)|(check)/.test(s)) return 'multi'
  if (/(判断)|(judge)|(bool)/.test(s)) return 'judge'
  if (/(填空)|(fill)|(blank)/.test(s)) return 'fill'
  if (/(简答)|(short)|(问答)/.test(s)) return 'short'
  if (/(应用)|(apply)/.test(s)) return 'apply'
  if (/(画图)|(绘图)|(作图)|(draw)/.test(s)) return 'draw'
  return null
}

// 解析选择题答案："ABD" / "A,B,D" / "A、B" → 索引数组
export function parseChoiceAnswer(raw, optionCount) {
  const letters = [...new Set(String(raw).toUpperCase().match(/[A-F]/g) || [])].sort()
  if (!letters.length) return { error: '答案无效：找不到 A-F 的选项字母' }
  for (const l of letters) {
    if (OPTION_LETTERS.indexOf(l) >= optionCount) {
      return { error: `答案 ${l} 超出选项范围（仅提供了 ${optionCount} 个选项）` }
    }
  }
  return { indices: letters.map((l) => OPTION_LETTERS.indexOf(l)) }
}

// 解析判断题答案 → 0(对) / 1(错)
export function parseJudgeAnswer(raw) {
  const s = String(raw).trim().toLowerCase()
  if (['对', '正确', '√', 't', 'true', 'y', 'yes', '是'].includes(s)) return 0
  if (['错', '错误', '×', 'x', 'f', 'false', 'n', 'no', '否'].includes(s)) return 1
  return null
}

// 填空题可接受答案："A|B" / "A；B" / "A;B" → 数组
export function splitFillAnswers(raw) {
  return String(raw)
    .split(/[|；;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function genId(prefix = 'id') {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}
