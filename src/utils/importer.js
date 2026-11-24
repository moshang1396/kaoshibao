import * as XLSX from 'xlsx'
import { normalizeType, parseChoiceAnswer, parseJudgeAnswer, splitFillAnswers, genId } from './types'

// ============ 模板下载 ============
export const TEMPLATE_HEADERS = ['题型', '题干', '选项A', '选项B', '选项C', '选项D', '选项E', '选项F', '答案', '解析', '标签']

export const TEMPLATE_ROWS = [
  ['单选题', 'HTTP 默认的服务端口是？', '21', '80', '443', '8080', '', '', 'B', 'HTTP 默认端口为 80，HTTPS 默认 443。', '网络,基础'],
  ['多选题', '下列属于关系型数据库的有？', 'MySQL', 'Redis', 'Oracle', 'MongoDB', '', '', 'AC', 'Redis、MongoDB 是非关系型数据库。', '数据库'],
  ['判断题', 'TCP 是面向连接的可靠传输协议。', '', '', '', '', '', '', '对', 'TCP 面向连接、可靠；UDP 无连接。', '网络'],
  ['填空题', 'Oracle 中返回当前系统日期时间的函数是____。', '', '', '', '', '', '', 'SYSDATE', '也可使用 CURRENT_DATE 等。', 'Oracle'],
  ['简答题', '简述主键和外键的区别。', '', '', '', '', '', '', '主键唯一标识表中的记录且不能为空；外键用于建立表与表之间的引用关系。', '外键值必须引用另一表的主键或唯一键。', '数据库'],
  ['应用题', '写出 SQL：查询 employees 表中 salary 高于 3000 的姓名与薪水。', '', '', '', '', '', '', 'SELECT name, salary FROM employees WHERE salary > 3000;', '按需求还可加 ORDER BY 排序。', 'SQL'],
  ['画图题', '画出浏览器输入 URL 后的大致处理流程框图。', '', '', '', '', '', '', '参考流程：DNS 解析 → 建立 TCP 连接 → 发送 HTTP 请求 → 服务器处理 → 返回响应 → 浏览器渲染。', '包含主要环节即可。', '网络']
]

export function downloadTemplate() {
  const aoa = [TEMPLATE_HEADERS, ...TEMPLATE_ROWS]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = [
    { wch: 8 }, { wch: 40 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 10 },
    { wch: 12 }, { wch: 36 }, { wch: 12 }
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '题目')
  XLSX.writeFile(wb, '考试宝导入模板.xlsx')
}

// ============ Excel / CSV 文件解析 ============
export function readWorkbook(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        if (!ws) return reject(new Error('工作簿中没有工作表'))
        const grid = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
        resolve(grid)
      } catch (err) {
        reject(err)
      }
    }
    reader.readAsArrayBuffer(file)
  })
}

// 表头定位：返回 { type, stem, options[0..5], answer, explanation, tags } 的列号映射
function mapHeaders(headers) {
  const find = (pred) => headers.findIndex((h, i) => pred(String(h ?? '').replace(/\s+/g, ''), i))
  const map = {
    type: find((h) => h.includes('题型')),
    stem: find((h) => h.includes('题干') || h.includes('题目') || h.includes('问题')),
    answer: find((h) => h === '答案' || h.includes('正确答案') || h.includes('参考答案')),
    explanation: find((h) => h.includes('解析') || h.includes('答案解析')),
    tags: find((h) => h.includes('标签')),
    options: []
  }
  for (let i = 0; i < 6; i++) {
    map.options.push(find((h) => h === `选项${'ABCDEF'[i]}`))
  }
  return map
}

// grid → 原始行数组（含行号）
export function gridToRows(grid) {
  if (!grid || !grid.length) return { rows: [], headerError: '文件内容为空' }
  const headers = grid[0].map((h) => String(h ?? '').trim())
  const colMap = mapHeaders(headers)
  const required = [colMap.type, colMap.stem, colMap.answer]
  if (required.some((i) => i === -1)) {
    return { rows: [], headerError: '表头缺少必需列：题型 / 题干 / 答案（请使用官方模板）' }
  }
  const rows = []
  for (let r = 1; r < grid.length; r++) {
    const line = grid[r] || []
    const cell = (i) => (i === -1 || i == null ? '' : String(line[i] ?? '').trim())
    const nonEmpty = line.some((c) => String(c ?? '').trim() !== '')
    if (!nonEmpty) continue
    rows.push({
      rowNo: r + 1, // Excel 实际行号（第1行是表头）
      type: cell(colMap.type),
      stem: cell(colMap.stem),
      options: colMap.options.map((i) => cell(i)).filter((s) => s !== ''),
      answer: cell(colMap.answer),
      explanation: cell(colMap.explanation),
      tags: cell(colMap.tags)
    })
  }
  if (!rows.length) return { rows: [], headerError: '表头之后没有任何数据行' }
  return { rows }
}

// ============ 单行校验 ============
export function validateRow(row) {
  const errors = []
  const type = normalizeType(row.type)
  if (!type) {
    errors.push(`题型无效：「${row.type || '空'}」，应为 单选/多选/判断/填空/简答/应用/画图`)
    return { errors }
  }
  if (!row.stem) errors.push('题干不能为空')

  let options = []
  let answer

  if (type === 'single' || type === 'multi') {
    options = row.options
    if (options.length < 2) errors.push('选择题至少需要 2 个选项')
    const parsed = parseChoiceAnswer(row.answer, options.length)
    if (parsed.error) {
      errors.push(parsed.error)
    } else {
      if (type === 'single' && parsed.indices.length > 1) errors.push('单选题答案只能是一个字母')
      if (type === 'multi' && parsed.indices.length < 2) errors.push('多选题答案至少包含两个字母')
      answer = parsed.indices
    }
  } else if (type === 'judge') {
    options = ['对', '错']
    const j = parseJudgeAnswer(row.answer)
    if (j == null) {
      errors.push('判断题答案应为：对 / 错（也接受 √/×、true/false）')
    } else {
      answer = [j]
    }
  } else if (type === 'fill') {
    const accepts = splitFillAnswers(row.answer)
    if (!accepts.length) errors.push('填空题答案不能为空（多个可接受答案用 | 或 ；分隔）')
    answer = accepts
  } else {
    // 简答 / 应用 / 画图：答案列 = 参考答案
    if (!row.answer) errors.push('主观题需要在「答案」列填写参考答案')
    answer = row.answer
  }

  if (errors.length) return { errors }

  const tags = String(row.tags || '')
    .split(/[,，、\s]+/)
    .map((t) => t.trim())
    .filter(Boolean)

  return {
    ok: true,
    question: {
      id: genId('q'),
      type,
      stem: row.stem,
      options,
      answer,
      explanation: row.explanation || '',
      tags,
      createdAt: Date.now()
    }
  }
}

// ============ 批量校验 ============
export function validateRows(rows) {
  const valid = []
  const invalid = []
  for (const row of rows) {
    const res = validateRow(row)
    if (res.ok) {
      valid.push({ rowNo: row.rowNo, question: res.question, raw: row })
    } else {
      invalid.push({ rowNo: row.rowNo, raw: row, errors: res.errors })
    }
  }
  return { valid, invalid }
}

// ============ JSON 导入 ============
// 支持中文键（与 Excel 列一致），也接受英文键别名
export function parseJsonImport(text) {
  let data
  try {
    data = JSON.parse(text)
  } catch (e) {
    return { error: 'JSON 格式错误：' + e.message }
  }
  if (!Array.isArray(data)) return { error: 'JSON 顶层必须是题目数组 [ {...}, {...} ]' }
  const rows = data.map((obj, i) => ({
    rowNo: i + 1,
    type: obj['题型'] ?? obj.type ?? '',
    stem: obj['题干'] ?? obj.stem ?? '',
    options: [obj['选项A'] ?? obj['选项a'] ?? obj.optA ?? '', obj['选项B'] ?? obj['选项b'] ?? obj.optB ?? '', obj['选项C'] ?? obj['选项c'] ?? '', obj['选项D'] ?? obj['选项d'] ?? '', obj['选项E'] ?? '', obj['选项F'] ?? '']
      .map((s) => String(s ?? '').trim())
      .filter(Boolean),
    answer: String(obj['答案'] ?? obj.answer ?? '').trim(),
    explanation: String(obj['解析'] ?? obj.explanation ?? '').trim(),
    tags: String(obj['标签'] ?? obj.tags ?? '').trim()
  }))
  return { rows }
}
