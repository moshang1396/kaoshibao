// 冒烟测试 v2：验证练习页新功能
// 答对零延迟跳转 / 答对显示解析 / 答题卡圆圈状态与跳题 / 上一题下一题 / 答题卡开关
import { chromium } from 'playwright-core'

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const XLSX = 'C:/Users/A3202/Desktop/C++复习题_考试宝导入模板.xlsx'
const BASE = 'http://127.0.0.1:5173'

const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push('[console] ' + m.text()) })
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message))

let pass = 0, fail = 0
const ok = (name, cond, extra = '') => {
  cond ? pass++ : fail++
  console.log((cond ? '✓' : '✗') + ' ' + name + (extra ? '  ' + extra : ''))
}

// ===== 准备：导入题库并进入练习 =====
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.clear())
await page.reload({ waitUntil: 'networkidle' })
await page.click('text=📥 导入题库')
await page.locator('input[type=file]').setInputFiles(XLSX)
await page.waitForTimeout(1200)
await page.click('button:has-text("确认导入")')
await page.waitForTimeout(800)
await page.click('button:has-text("开始练习")')
await page.waitForTimeout(600)

// 从 localStorage 找出第一题的正确答案选项
const q1 = await page.evaluate(() => {
  const data = JSON.parse(localStorage.getItem('ksb_banks_v1'))
  const arr = Object.values(data.questions)[0]
  const first = arr[0]
  return { id: first.id, type: first.type, answer: first.answer, options: first.options.length }
})
ok('第一题为单选', q1.type === 'single', JSON.stringify(q1.answer))

// ===== 1. 答对 → 零延迟跳下一题 =====
const correctLetter = 'ABCDEF'[q1.answer[0]]
const t0 = Date.now()
await page.locator('.opt', { hasText: new RegExp('^\\s*' + correctLetter) }).first().click()
await page.waitForSelector('text=第 2 / 205 题', { timeout: 1500 })
const elapsed = Date.now() - t0
ok('答对后立即跳到第2题（无延迟）', elapsed < 700, `耗时 ${elapsed}ms`)

// ===== 2. 上一题 → 回看第1题，显示「回答正确」+ 解析 =====
await page.click('button:has-text("← 上一题")')
await page.waitForSelector('text=第 1 / 205 题', { timeout: 1500 })
ok('上一题回跳正常', true)
const okAlert = await page.locator('.alert.ok:has-text("回答正确")').count()
ok('答对状态显示「回答正确」', okAlert === 1)
const expBox = await page.locator('.explanation-box:has-text("解析")').count()
ok('答对也显示解析', expBox === 1)
const lockedOpt = await page.locator('.opt.disabled').count()
ok('已答题目锁定不可改', lockedOpt > 0)

// ===== 3. 答题卡圆圈状态 =====
const dotOk = await page.locator('.sheet-dot.ok').count()
const dotBlank = await page.locator('.sheet-dot.blank').count()
ok('答题卡第1题显示绿色圆圈', dotOk === 1)
ok('其余题目显示未答圆圈', dotBlank === 204, `blank=${dotBlank}`)
const curDot = await page.locator('.sheet-dot.current').textContent()
ok('当前题号高亮', curDot.trim() === '1')

// ===== 4. 点击圆圈跳题 =====
await page.locator('.sheet-dot', { hasText: /^10$/ }).click()
await page.waitForSelector('text=第 10 / 205 题', { timeout: 1500 })
ok('点击圆圈10跳题成功', true)

// ===== 5. 答错 → 显示解析 + 红圈；下一题按钮自由切换 =====
await page.locator('.opt').first().click() // 乱答一个（大概率错）
await page.waitForTimeout(400)
const errAlert = await page.locator('.alert.err:has-text("回答错误")').count()
const expWrong = await page.locator('.explanation-box:has-text("解析")').count()
ok('答错显示错误反馈', errAlert === 1)
ok('答错显示解析', expWrong === 1)
const dotWrong = await page.locator('.sheet-dot.wrong').count()
ok('答题卡显示红色圆圈', dotWrong === 1)
await page.click('button:has-text("下一题")')
await page.waitForSelector('text=第 11 / 205 题', { timeout: 1500 })
ok('答错后手动「下一题」正常', true)

// ===== 6. 答题卡开关 =====
await page.click('button:has-text("收起答题卡")')
const hidden = await page.locator('.sheet').isHidden()
ok('答题卡可收起', hidden)
await page.click('button:has-text("答题卡 ▼")')
const visible = await page.locator('.sheet').isVisible()
ok('答题卡可再展开', visible)

// ===== 7. 最后一题显示「完成，查看小结」 =====
await page.locator('.sheet-dot', { hasText: /^205$/ }).click()
await page.waitForSelector('text=第 205 / 205 题', { timeout: 1500 })
const finishBtn = await page.locator('button:has-text("完成，查看小结")').count()
ok('最后一题出现完成按钮', finishBtn === 1)
await page.click('button:has-text("完成，查看小结")')
await page.waitForSelector('text=练习小结', { timeout: 2000 })
ok('进入练习小结页', true)

console.log(`\n${pass} 通过, ${fail} 失败`)
console.log('===== 控制台错误（' + errors.length + ' 条）=====')
for (const e of errors.slice(0, 10)) console.log(e)

await browser.close()
process.exit(fail || errors.length ? 1 : 0)
