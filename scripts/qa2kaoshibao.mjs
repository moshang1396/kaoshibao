// 将问答题答案文档（docx 提取的段落 txt，每行一段）转换为 考试宝 Excel 导入模板
// 用法: node scripts/qa2kaoshibao.mjs <段落txt> <输出.xlsx>
// 题干判定：段落包含 ？/? ，或以 简述/什么是/请/试述/说明/写出/列举/叙述/画出 开头，或以数字编号开头
import fs from 'node:fs'
import * as XLSX from 'xlsx'

const [, , srcArg, outArg] = process.argv
if (!srcArg || !outArg) {
  console.error('用法: node scripts/qa2kaoshibao.mjs <段落txt> <输出.xlsx>')
  process.exit(1)
}

const paras = fs.readFileSync(srcArg, 'utf8').replace(/^\uFEFF/, '')
  .split(/\r?\n/).map((l) => l.trim()).filter(Boolean)

const isQuestion = (t) =>
  /[？？?]/.test(t) ||
  /^(简述|请简述|什么是|试述|请说明|说明|写出|列举|叙述|画出|请)/.test(t) ||
  /^\d+[．.、]/.test(t)

const rows = []
let cur = null
for (const t of paras) {
  if (!cur) {
    if (!isQuestion(t)) { console.error(`[警告] 首段不是题干，跳过：${t.slice(0, 30)}`); continue }
    cur = { q: t, a: [] }
    rows.push(cur)
  } else if (isQuestion(t)) {
    cur = { q: t, a: [] }
    rows.push(cur)
  } else {
    cur.a.push(t)
  }
}

// 清理题干编号（如 "16．"）
const cleanQ = (q) => q.replace(/^\d+[．.、]\s*/, '')

console.log(`共解析 ${rows.length} 道题：`)
rows.forEach((r, i) => {
  console.log(`${i + 1}. ${r.q}（答案 ${r.a.length} 段）`)
  if (!r.a.length) console.error(`  [警告] 第 ${i + 1} 题没有答案段落！`)
})

const headers = ['题型', '题干', '选项A', '选项B', '选项C', '选项D', '选项E', '选项F', '答案', '解析', '标签']
const data = rows.map((r) => [
  '问答题', cleanQ(r.q), '', '', '', '', '', '',
  r.a.join('\n'), '', 'C++问答题',
])

const wb = XLSX.utils.book_new()
const ws = XLSX.utils.aoa_to_sheet([headers, ...data])
ws['!cols'] = [{ wch: 8 }, { wch: 60 }, { wch: 4 }, { wch: 4 }, { wch: 4 }, { wch: 4 }, { wch: 4 }, { wch: 4 }, { wch: 80 }, { wch: 10 }, { wch: 12 }]
XLSX.utils.book_append_sheet(wb, ws, '题库')
XLSX.writeFile(wb, outArg)
console.log(`\n已生成: ${outArg}`)
