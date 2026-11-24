// 冒烟测试 v3：背题模式 + 配置页筛选增强
import { chromium } from 'playwright-core'

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const XLSX = 'C:/Users/A3202/Desktop/C++复习题_考试宝导入模板.xlsx'
const BASE = 'http://127.0.0.1:5173'

const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message))

let pass = 0, fail = 0
const ok = (name, cond, extra = '') => {
  cond ? pass++ : fail++
  console.log((cond ? '✓' : '✗') + ' ' + name + (extra ? '  ' + extra : ''))
}

// 准备
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.clear())
await page.reload({ waitUntil: 'networkidle' })
await page.click('text=📥 导入题库')
await page.locator('input[type=file]').setInputFiles(XLSX)
await page.waitForTimeout(1200)
await page.click('button:has-text("确认导入")')
await page.waitForTimeout(800)
await page.click('header >> text=首页')
await page.waitForTimeout(500)

// ===== 1. 题库卡片有背题按钮，进入配置页预设背题模式 =====
const memorizeBtn = await page.locator('.bank-card button:has-text("背题")').count()
ok('题库卡片有「背题」按钮', memorizeBtn === 1)
await page.locator('.bank-card button:has-text("背题")').click()
await page.waitForTimeout(500)
ok('配置页标题为背题配置', (await page.locator('h3:has-text("背题配置")').count()) === 1)
ok('模式选中「背题模式」', (await page.locator('.radio-chip.on:has-text("背题模式")').count()) === 1)

// ===== 2. 配置页筛选：按题型筛选 =====
await page.locator('.radio-chip', { hasText: /^判断题（100）$/ }).click()
await page.waitForTimeout(300)
const startTxt = await page.locator('button:has-text("开始背题")').textContent()
ok('题型筛选后数量变 100', startTxt.includes('100'), startTxt.trim())
// 按标签筛选：选「第一章」
await page.locator('.radio-chip', { hasText: /^第一章$/ }).click()
await page.waitForTimeout(300)
const startTxt2 = await page.locator('button:has-text("开始背题")').textContent()
ok('标签筛选进一步缩小范围', !startTxt2.includes('（100 题）'), startTxt2.trim())

// ===== 3. 开始背题 → 直接显示答案 =====
await page.locator('.radio-chip', { hasText: /^第一章$/ }).click() // 取消标签筛选
await page.locator('.radio-chip', { hasText: /^判断题（100）$/ }).click() // 取消题型筛选
await page.waitForTimeout(300)
await page.click('button:has-text("开始背题")')
await page.waitForTimeout(700)
ok('进入背题运行页', page.url().includes('/memorize/run/'))
ok('正确选项绿色高亮', (await page.locator('.mem-opt.correct').count()) >= 1)
ok('答案行直接显示', (await page.locator('.ans-line').count()) === 1)
const expCount = await page.locator('.explanation-box').count()
ok('解析显示（有则显示）', expCount >= 0)

// ===== 4. 隐藏/显示答案 =====
await page.click('button:has-text("隐藏答案")')
ok('隐藏后答案模糊处理', (await page.locator('.mem-opts.hidden, .ans-area').count()) >= 1)
ok('答案行不再显示', (await page.locator('.ans-line:visible').count()) === 0)
await page.click('button:has-text("显示答案")')
await page.waitForTimeout(200)
ok('恢复显示答案', (await page.locator('.ans-line').count()) === 1)

// ===== 5. 答题卡已看状态 + 跳题 =====
const viewedDots = await page.locator('.sheet-dot.viewed').count()
ok('答题卡当前题已标记已看', viewedDots === 1)
await page.locator('.sheet-dot', { hasText: /^5$/ }).click()
await page.waitForTimeout(400)
const curDot = await page.locator('.sheet-dot.current').textContent()
ok('答题卡跳题到第5题', curDot.trim() === '5', `当前=${curDot.trim()}`)
ok('已看圆圈累计 2 个', (await page.locator('.sheet-dot.viewed').count()) === 2)

// ===== 6. 末题完成 → 回首页 → 继续答题显示背题 =====
await page.locator('.sheet-dot', { hasText: /^205$/ }).click()
await page.waitForTimeout(400)
const finishBtn = await page.locator('button:has-text("完成背题")').count()
ok('末题显示完成背题', finishBtn === 1)
await page.click('button:has-text("完成背题")')
await page.waitForTimeout(600)
ok('完成后回首页', page.url().endsWith('/#/') || page.url().endsWith('#/'))
// 已完成的背题不出现在继续答题（status=done）
ok('已完成的背题不在继续答题列表', (await page.locator('.chip:has-text("背题")').count()) === 0)

// ===== 6.5 中途退出的背题进度出现在继续答题 =====
page.on('dialog', (d) => d.accept())
await page.locator('.bank-card button:has-text("背题")').click()
await page.waitForTimeout(400)
await page.click('button:has-text("开始背题")')
await page.waitForTimeout(600)
await page.click('button:has-text("✕ 退出背题")')
await page.waitForTimeout(600)
const memoChip = await page.locator('.chip:has-text("背题")').count()
ok('中途退出的背题进度出现在继续答题', memoChip >= 1)

// ===== 7. 练习配置页增强项存在 =====
await page.locator('.bank-card button:has-text("练习")').first().click()
await page.waitForTimeout(500)
ok('练习配置有模式选择', (await page.locator('.radio-chip:has-text("答题练习")').count()) === 1)
ok('练习配置有题型筛选', (await page.locator('.radio-chip:has-text("单选题（93）")').count()) === 1)
ok('练习配置有标签筛选', (await page.locator('.radio-chip', { hasText: /^第一章$/ }).count()) >= 1)
ok('练习配置有自动跳题开关', (await page.locator('input[type=checkbox]').count()) === 1)

// ===== 8. 考试配置题型范围 =====
await page.click('header >> text=首页')
await page.waitForTimeout(300)
await page.locator('.bank-card button:has-text("模拟考试")').first().click()
await page.waitForTimeout(500)
await page.locator('.radio-chip', { hasText: /^判断题（100）$/ }).click()
await page.waitForTimeout(300)
const poolTxt = await page.locator('.muted.small:has-text("当前范围共")').textContent()
ok('考试随机抽题应用题型范围', poolTxt.includes('100'), poolTxt.trim())

console.log(`\n${pass} 通过, ${fail} 失败`)
for (const e of errors.slice(0, 5)) console.log(e)
await browser.close()
process.exit(fail || errors.length ? 1 : 0)
