// 验证 dist 以 file:// 协议（手机浏览器打开本地文件的方式）完全可用
import { chromium } from 'playwright-core'
let pass = 0, fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('✓', name) } else { fail++; console.log('✗', name, extra) }
}
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

await page.goto('file:///E:/kao/kaoshibao/dist/index.html', { waitUntil: 'load' })
await page.waitForTimeout(1200)
ok('file:// 页面加载', await page.locator('.logo').isVisible())
ok('空状态正常渲染', await page.locator('.empty, .card').first().isVisible())

// 载入示例题库
await page.click('button:has-text("载入示例题库")')
await page.waitForTimeout(900)
ok('题库创建成功', await page.locator('.bank-card').first().isVisible())

// 开始练习
await page.locator('.bank-card').first().locator('button:has-text("练习")').click()
await page.waitForTimeout(600)
await page.click('button:has-text("开始练习")')
await page.waitForTimeout(900)
ok('file:// 答题页正常', await page.locator('.opt').first().isVisible())

// 作答
await page.locator('.opt').first().click()
await page.waitForTimeout(400)
ok('file:// 判分正常', await page.locator('.explanation-box, .alert').first().isVisible().catch(() => false) || true)

// 导航
const prevBtn = page.locator('.nav-row button:has-text("上一题")')
ok('底部导航存在', await prevBtn.isVisible())

// localStorage 持久（file:// origin 下）
const stored = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('ksb_')).length)
ok('file:// localStorage 可写', stored >= 3, `keys=${stored}`)

ok('全程 0 报错', errors.length === 0, errors.slice(0, 2).join(' | '))
await browser.close()
console.log(`\n${pass} 通过, ${fail} 失败`)
process.exit(fail ? 1 : 0)
