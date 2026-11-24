// 将 Markdown 题库文档转换为 考试宝 Excel 导入模板
// 用法: node scripts/md2kaoshibao.mjs <输入.md> <输出.xlsx>
import fs from 'node:fs'
import * as XLSX from 'xlsx'

const [, , srcArg, outArg] = process.argv
if (!srcArg || !outArg) {
  console.error('用法: node scripts/md2kaoshibao.mjs <输入.md> <输出.xlsx>')
  process.exit(1)
}

const md = fs.readFileSync(srcArg, 'utf8').replace(/^\uFEFF/, '')

// ============ 1. 按标题切块 ============
const chunks = []
let cur = null
for (const line of md.split(/\r?\n/)) {
  const m = line.match(/^(#{2,4})\s+(.*)/)
  if (m) {
    cur = { level: m[1].length, title: m[2].trim(), lines: [] }
    chunks.push(cur)
  } else if (cur) {
    cur.lines.push(line)
  }
}

// ============ 2. 文本清理 ============
function cleanText(s, { keepNewlines = false } = {}) {
  s = s.replace(/&#x20;/g, ' ')
  if (keepNewlines) {
    s = s.split('\n').map((l) => l.replace(/\s+$/, '')).join('\n')
  } else {
    s = s.replace(/\s*\n+\s*/g, ' ')
  }
  return s
    .replace(/`/g, '')
    .replace(/\\_/g, '_')
    .replace(/\*\*/g, '')
    .replace(/[ \t]+$/gm, '')
    .trim()
}

// ============ 3. 解析 ============
const rows = []
const warnings = []

function parseChoice(block, chapter, juan) {
  const ansIdx = block.indexOf('答案：')
  const expIdx = block.indexOf('解析：')
  if (ansIdx === -1 || expIdx === -1) {
    warnings.push(`[选择题] 未找到答案/解析标记：${block.slice(0, 40)}…`)
    return
  }
  const stemRegion = block.slice(0, ansIdx)
  const ansText = block.slice(ansIdx + 3, expIdx)
  const expText = block.slice(expIdx + 3)

  // 选项区：从第一个 A． 开始
  const optStart = stemRegion.search(/(?:^|[\s　])A[．.]/)
  let stem, optsRegion
  if (optStart === -1) {
    stem = stemRegion
    optsRegion = ''
    warnings.push(`[选择题] 未找到选项 A．：${stemRegion.slice(0, 40)}…`)
  } else {
    stem = stemRegion.slice(0, optStart)
    optsRegion = stemRegion.slice(optStart)
  }

  // 定位各选项字母标记位置
  const marks = []
  for (const L of ['A', 'B', 'C', 'D', 'E', 'F']) {
    const re = new RegExp(`(?:^|[\\s　])${L}[．.]`, 'g')
    const m = re.exec(optsRegion)
    if (m) marks.push({ L, idx: m.index + m[0].indexOf(L) })
  }
  marks.sort((a, b) => a.idx - b.idx)
  const options = marks.map((mk, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].idx : optsRegion.length
    // mk.idx 指向选项字母，其后紧跟「．」或「.」，共占 2 字符
    return cleanText(optsRegion.slice(mk.idx + 2, end))
  }).filter(Boolean)

  // 答案字母
  const am = ansText.replace(/\*/g, '').match(/^\s*([A-F])/)
  if (!am) {
    warnings.push(`[选择题] 答案非字母：${ansText.slice(0, 30)}`)
    return
  }
  const letter = am[1]
  if (options.length < 2) {
    warnings.push(`[选择题] 选项不足 2 个：${stem.slice(0, 30)}`)
    return
  }
  const li = 'ABCDEF'.indexOf(letter)
  if (li >= options.length) {
    warnings.push(`[选择题] 答案 ${letter} 超出选项数 ${options.length}：${stem.slice(0, 30)}`)
    return
  }

  rows.push({
    type: '单选题',
    stem: cleanText(stem),
    options: options.slice(0, 6),
    answer: letter,
    explanation: cleanText(expText),
    tags: `${chapter},${juan}`
  })
}

function parseJudge(block, chapter, juan) {
  const ansIdx = block.indexOf('答案：')
  const expIdx = block.indexOf('解析：')
  if (ansIdx === -1 || expIdx === -1) {
    warnings.push(`[判断题] 未找到答案/解析标记：${block.slice(0, 40)}…`)
    return
  }
  const stem = cleanText(block.slice(0, ansIdx))
  const ansText = block.slice(ansIdx + 3, expIdx).replace(/\*/g, '')
  const expText = block.slice(expIdx + 3)

  let answer = null
  if (/[√对正确]/.test(ansText.slice(0, 4))) answer = '对'
  else if (/[×错✗]/.test(ansText.slice(0, 4))) answer = '错'
  if (!answer) {
    warnings.push(`[判断题] 答案无法识别：${ansText.slice(0, 20)}`)
    return
  }
  rows.push({
    type: '判断题',
    stem,
    options: [],
    answer,
    explanation: cleanText(expText),
    tags: `${chapter},${juan}`
  })
}

function parseProg(block, chapter, juan) {
  const ansIdx = block.indexOf('答案：')
  const expIdx = block.indexOf('解析：')
  if (ansIdx === -1 || expIdx === -1) {
    warnings.push(`[程序分析题] 未找到答案/解析标记：${block.slice(0, 40)}…`)
    return
  }
  // 题干：去掉代码围栏行，保留代码与说明
  const stemRegion = block.slice(0, ansIdx)
    .split('\n')
    .filter((l) => !/^\s*```/.test(l))
    .join('\n')
  // 答案：同样去掉围栏
  const ansRegion = block.slice(ansIdx + 3, expIdx)
    .split('\n')
    .filter((l) => !/^\s*```/.test(l))
    .join('\n')
  // 解析：去掉引用块与分隔线
  const expRegion = block.slice(expIdx + 3)
    .split('\n')
    .filter((l) => !/^\s*(>|---\s*$)/.test(l))
    .join('\n')

  const stem = cleanText(stemRegion, { keepNewlines: true })
  const answer = cleanText(ansRegion, { keepNewlines: true })
  if (!stem || !answer) {
    warnings.push(`[程序分析题] 题干或答案为空：${stem.slice(0, 30)}`)
    return
  }
  rows.push({
    type: '应用题',
    stem,
    options: [],
    answer,
    explanation: cleanText(expRegion, { keepNewlines: true }),
    tags: `${chapter},${juan},程序分析`
  })
}

// ============ 4. 遍历文档结构 ============
let chapter = ''
let juan = ''
for (const c of chunks) {
  if (c.level === 2) {
    if (/^附录/.test(c.title)) break
    const chm = c.title.match(/第[一二三四五六七八九十]+章/)
    chapter = chm ? chm[0] : c.title
  } else if (c.level === 3) {
    const jm = c.title.match(/([AB])\s*卷/)
    juan = jm ? jm[1] + '卷' : c.title
  } else if (c.level === 4) {
    let sec = null
    if (/选择题/.test(c.title)) sec = 'choice'
    else if (/判断题/.test(c.title)) sec = 'judge'
    else if (/程序分析/.test(c.title)) sec = 'prog'
    if (sec) {
      const body = c.lines.join('\n')
      const parts = body.split(/\*\*\d+．\*\*/)
      for (let i = 1; i < parts.length; i++) {
        const block = parts[i]
        if (sec === 'choice') parseChoice(block, chapter, juan)
        else if (sec === 'judge') parseJudge(block, chapter, juan)
        else parseProg(block, chapter, juan)
      }
    }
  }
}

// ============ 5. 生成 xlsx ============
const HEADER = ['题型', '题干', '选项A', '选项B', '选项C', '选项D', '选项E', '选项F', '答案', '解析', '标签']
const aoa = [HEADER]
for (const r of rows) {
  const opt = [0, 1, 2, 3, 4, 5].map((i) => r.options[i] || '')
  aoa.push([r.type, r.stem, ...opt, r.answer, r.explanation, r.tags])
}

const ws = XLSX.utils.aoa_to_sheet(aoa)
ws['!cols'] = [
  { wch: 8 }, { wch: 55 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 14 }, { wch: 14 },
  { wch: 12 }, { wch: 55 }, { wch: 16 }
]
const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, ws, '题目')
XLSX.writeFile(wb, outArg)

// ============ 6. 汇总 ============
const stat = {}
for (const r of rows) stat[r.type] = (stat[r.type] || 0) + 1
console.log(`✅ 已生成: ${outArg}`)
console.log(`共 ${rows.length} 题:`, JSON.stringify(stat))
if (warnings.length) {
  console.log(`\n⚠️ ${warnings.length} 条警告:`)
  for (const w of warnings) console.log('  ' + w)
}
