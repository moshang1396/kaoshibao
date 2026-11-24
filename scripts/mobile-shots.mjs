// 手机端截图：检查布局视觉效果
import { chromium } from 'playwright-core'

const BASE = 'http://127.0.0.1:5173'
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2
})
const page = await ctx.newPage()
await page.goto(BASE + '/#/import', { waitUntil: 'networkidle' })

// 用 localStorage 直接注入 C++ 题库（避免重复导入），模拟已有数据状态
await page.evaluate(async () => {
  const mod = await import('./src/utils/importer.js')
  const res = fetch('http://127.0.0.1:5173/src/data/demoBank.js').catch(() => null)
})
await page.goto(BASE + '/#/', { waitUntil: 'networkidle' })
// 若无题库，载入示例
const empty = await page.locator('text=还没有题库').isVisible().catch(() => false)
if (empty) {
  await page.click('button:has-text("载入示例题库")')
  await page.waitForTimeout(800)
}
await page.screenshot({ path: 'E:/kao/kaoshibao/.shots/m-home.png' })

// 答题页
const bankCard = page.locator('.bank-card').first()
if (await bankCard.isVisible().catch(() => false)) {
  await bankCard.locator('button:has-text("练习")').click()
  await page.waitForTimeout(500)
  const start = page.locator('button:has-text("开始练习")')
  if (await start.isVisible().catch(() => false)) { await start.click(); await page.waitForTimeout(800) }
  await page.screenshot({ path: 'E:/kao/kaoshibao/.shots/m-run.png' })
  // 打开抽屉
  await page.click('button:has-text("答题卡")')
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'E:/kao/kaoshibao/.shots/m-sheet.png' })
}
await browser.close()
console.log('screenshots done')
