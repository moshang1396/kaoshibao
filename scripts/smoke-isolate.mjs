// 隔离专项测试：不同题库的错题本与统计互相独立
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

// 准备：清空 → 导入 C++ 库(A) → 载入示例库(B)
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.clear())
await page.reload({ waitUntil: 'networkidle' })
await page.click('text=📥 导入题库')
await page.locator('input[type=file]').setInputFiles(XLSX)
await page.waitForTimeout(1200)
await page.click('button:has-text("确认导入")')
await page.waitForTimeout(600)
await page.click('header >> text=首页')
await page.waitForTimeout(400)
await page.click('button:has-text("载入示例题库")')
await page.waitForTimeout(600)

// 找出 A 库第一题和一个错误选项
const target = await page.evaluate(() => {
  const data = JSON.parse(localStorage.getItem('ksb_banks_v1'))
  const entries = Object.entries(data.questions)
  const bankA = entries.find(([id, qs]) => qs.length >= 100) // C++ 库
  const q = bankA[1][0]
  const correct = new Set(q.answer)
  const wrongIdx = [...Array(q.options.length).keys()].find((i) => !correct.has(i))
  return { bankAId: bankA[0], qid: q.id, wrongIdx, bankCount: entries.length }
})
ok('存在两个题库', target.bankCount === 2)

// 进入 A 库练习，答错第一题
await page.locator('.bank-card', { hasText: 'C++复习题' }).first().locator('button:has-text("练习")').click()
await page.waitForTimeout(500)
await page.click('button:has-text("开始练习")')
await page.waitForTimeout(600)
await page.locator('.opt').nth(target.wrongIdx).click()
await page.waitForTimeout(500)
ok('A 库答错一题产生反馈', (await page.locator('.alert.err').count()) === 1)

// 错题本：应显示 A 库 1 题、B 库 0 题
await page.click('header >> text=错题本')
await page.waitForTimeout(600)
const tabs = await page.locator('.bank-tab').allTextContents()
ok('错题本显示题库切换标签', tabs.length === 2, JSON.stringify(tabs))
const aBadge = await page.locator('.bank-tab', { hasText: 'C++复习题' }).locator('.badge-n.nonzero').textContent().catch(() => null)
ok('A 库错题徽标 = 1', aBadge?.trim() === '1', `got=${aBadge}`)
const bTab = page.locator('.bank-tab').nth(1)
const bText = await bTab.textContent()
ok('B 库（示例）徽标 = 0', bText.includes('0'), bText.trim())
ok('列表显示 A 库错题 1 条', (await page.locator('.wrong-card').count()) === 1)

// 切到 B 库 → 空
await bTab.click()
await page.waitForTimeout(300)
ok('切到 B 库错题本为空', (await page.locator('.card.empty:has-text("错题本是空的")').count()) === 1)

// 统计隔离
await page.click('header >> text=统计')
await page.waitForTimeout(500)
const allStat = await page.locator('.stat-card').first().locator('.num').textContent()
ok('全部题库累计答题 = 1', allStat.trim() === '1', `got=${allStat}`)
await page.locator('.bank-tab', { hasText: 'Oracle' }).click() // 示例库名含 Oracle
await page.waitForTimeout(300)
const bStat = await page.locator('.stat-card').first().locator('.num').textContent()
ok('B 库累计答题 = 0（隔离）', bStat.trim() === '0', `got=${bStat}`)
await page.locator('.bank-tab', { hasText: 'C++复习题' }).click()
await page.waitForTimeout(300)
const aStat = await page.locator('.stat-card').first().locator('.num').textContent()
ok('A 库累计答题 = 1（隔离）', aStat.trim() === '1', `got=${aStat}`)
const aWrong = await page.locator('.stat-card').nth(2).locator('.num').textContent()
ok('A 库错题数 = 1', aWrong.trim() === '1')

// ===== 数据一致性：全局角标 与 题库徽标 相等 =====
await page.click('header >> text=错题本')
await page.waitForTimeout(400)
const navBadge = await page.locator('header .badge').textContent().catch(() => null)
ok('导航角标 = 1（与题库徽标统一）', navBadge?.trim() === '1', `got=${navBadge}`)

// ===== 删除答题记录不影响错题本 =====
// 先在 A 库再练一次并答错第一题（产生第二条含答题记录的进度），回首页删除该进度
await page.click('header >> text=首页')
await page.waitForTimeout(400)
await page.locator('.bank-card', { hasText: 'C++复习题' }).first().locator('button:has-text("练习")').click()
await page.waitForTimeout(400)
await page.click('button:has-text("开始练习")')
await page.waitForTimeout(500)
await page.locator('.opt').nth(target.wrongIdx).click()
await page.waitForTimeout(400)
await page.click('button:has-text("退出练习")')
await page.waitForTimeout(300)
await page.click('header >> text=首页')
await page.waitForTimeout(400)
page.on('dialog', (d) => d.accept())
const delBtns = page.locator('button:has-text("删除")')
ok('首页存在可删除的答题进度', (await delBtns.count()) >= 1)
await delBtns.first().click()
await page.waitForTimeout(500)
await page.click('header >> text=错题本')
await page.waitForTimeout(500)
const badgeAfterDel = await page.locator('.bank-tab', { hasText: 'C++复习题' }).locator('.badge-n').first().textContent()
ok('删除答题记录后错题本仍保留（每题一条去重）', badgeAfterDel?.trim() === '1', `got=${badgeAfterDel}`)
ok('错题列表仍显示 1 条', (await page.locator('.wrong-card').count()) === 1)
const navBadge2 = await page.locator('header .badge').textContent().catch(() => null)
ok('导航角标同步 = 1', navBadge2?.trim() === '1', `got=${navBadge2}`)
const timesChip = await page.locator('.chip:has-text("错 2 次")').count()
ok('同题再错显示"错 2 次"徽标', timesChip === 1)

// ===== 删除题库不影响错题本（快照独立） =====
await page.click('header >> text=首页')
await page.waitForTimeout(400)
await page.locator('.bank-card', { hasText: 'C++复习题' }).first().locator('button:has-text("删除")').click()
await page.waitForTimeout(600)
const dbg = await page.evaluate(() => ({
  banks: JSON.parse(localStorage.getItem('ksb_banks_v1') || '{}').banks?.map((b) => b.name),
  wb: JSON.parse(localStorage.getItem('ksb_wrongbook_v1') || '{}').entries?.map((e) => ({ bankId: e.bankId, stem: e.stem.slice(0, 10) })),
  tabs: [...document.querySelectorAll('.bank-tab')].map((t) => t.textContent.trim()),
  path: location.hash
}))
console.log('DEBUG:', JSON.stringify(dbg, null, 1))
await page.click('header >> text=错题本')
await page.waitForTimeout(500)
ok('出现"已删除题库"分组', (await page.locator('.bank-tab:has-text("已删除题库")').count()) === 1)
await page.locator('.bank-tab:has-text("已删除题库")').click()
await page.waitForTimeout(400)
const orphanCards = await page.locator('.wrong-card').count()
ok('题库删除后错题快照仍显示', orphanCards === 1, `got=${orphanCards}`)

console.log(`\n${pass} 通过, ${fail} 失败`)
for (const e of errors.slice(0, 5)) console.log(e)
await browser.close()
process.exit(fail || errors.length ? 1 : 0)
