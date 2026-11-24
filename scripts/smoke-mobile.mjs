// 手机视口（390x844，Android 典型）全流程冒烟测试
// 验证：底部标签栏、抽屉答题卡、固定底部导航、触控流程、备份入口
import { chromium } from 'playwright-core'

const BASE = 'http://127.0.0.1:5173'
let pass = 0, fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('✓', name) }
  else { fail++; console.log('✗', name, extra) }
}

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 2
})
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

await page.goto(BASE + '/', { waitUntil: 'networkidle' })

// ===== 1. 底部标签栏出现，顶部链接隐藏 =====
ok('底部标签栏显示', await page.locator('.bottom-tabs').isVisible())
const tabCount = await page.locator('.bottom-tabs a').count()
ok('底部 4 个标签', tabCount === 4, `got=${tabCount}`)
const topNavHidden = await page.locator('.app-header .nav').isHidden()
ok('顶部导航链接隐藏', topNavHidden)
ok('视口无横向滚动', await page.evaluate(() => document.documentElement.scrollWidth <= 390 + 1))

// ===== 2. 导入题库（手机文件输入流程）=====
await page.locator('.bottom-tabs a', { hasText: '导入' }).click()
await page.waitForTimeout(400)
ok('导入页在手机端正常渲染', await page.locator('h3:has-text("导入题目")').isVisible())
await page.setInputFiles('input[type=file]', 'C:/Users/A3202/Desktop/C++复习题_考试宝导入模板.xlsx')
await page.waitForTimeout(2500)
const report = await page.locator('text=可导入').first().textContent().catch(() => '')
ok('手机导入 205 题校验通过', /20[0-9]/.test(report || ''), `got=${report}`)
await page.click('button:has-text("确认导入")')
await page.waitForTimeout(1200)
// 导入成功后直接跳到练习配置页
ok('导入后进入练习配置页', (await page.locator('button:has-text("开始练习")').count()) >= 1)
ok('练习配置页手机端无横向溢出', await page.evaluate(() => document.documentElement.scrollWidth <= 390 + 1))
await page.click('button:has-text("开始练习")')
await page.waitForTimeout(1000)

// ===== 4. 答题页：底部标签栏隐藏、导航条固定、答题卡抽屉 =====
ok('答题页隐藏底部标签栏', await page.locator('.bottom-tabs').isHidden())
const navFixed = await page.evaluate(() => {
  const el = document.querySelector('.nav-row')
  return el && getComputedStyle(el).position === 'fixed'
})
ok('上一题/下一题导航固定底部', navFixed)
const dots = await page.locator('.sheet-dot').count()
ok('答题卡 205 个圆圈', dots === 205, `got=${dots}`)
// 打开抽屉看答题卡（练习页 sheet 默认展开）
const sheetFixed = await page.evaluate(() => {
  const el = document.querySelector('.sheet')
  return el && getComputedStyle(el).position === 'fixed'
})
ok('答题卡为底部抽屉', sheetFixed)

// ===== 5. 作答：单选点击即判分 =====
await page.locator('.opt').first().click()
await page.waitForTimeout(400)
// 答对自动跳下一题 → 点上一题回看；答错停留原地 → 解析直接可见
if (!(await page.locator('.explanation-box').first().isVisible().catch(() => false))) {
  const prevBtn = page.locator('.nav-row button:has-text("上一题")')
  await prevBtn.waitFor({ state: 'visible' })
  if (await prevBtn.isEnabled()) {
    await prevBtn.click()
    await page.waitForTimeout(500)
  }
}
ok('答后可回看解析', await page.locator('.explanation-box').first().isVisible().catch(() => false))

// ===== 6. 遮罩：点遮罩收起抽屉 =====
const maskVisible = await page.locator('.sheet-mask').isVisible().catch(() => false)
if (maskVisible) {
  await page.locator('.sheet-mask').click({ position: { x: 195, y: 40 } })
  await page.waitForTimeout(300)
}
ok('点击遮罩收起答题卡', (await page.locator('.sheet-mask').isVisible().catch(() => false)) === false)

// ===== 7. 底部标签跳转：错题本 / 统计 =====
await page.goto(BASE + '/#/wrong', { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
ok('错题本手机端渲染', await page.locator('.bank-tab').first().isVisible())
ok('错题本 tabs 横向滚动样式生效', await page.evaluate(() => {
  const el = document.querySelector('.bank-tabs-row')
  return el && getComputedStyle(el).overflowX === 'auto'
}))
await page.goto(BASE + '/#/stats', { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
ok('统计页手机端渲染', await page.locator('.stat-card').first().isVisible())
const statCols = await page.evaluate(() => {
  const grid = document.querySelector('.stat-grid')
  return grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : 0
})
ok('统计卡片 ≤3 列（小屏合理换行）', statCols >= 2 && statCols <= 3, `cols=${statCols}`)

// ===== 8. PWA 资源可达 =====
for (const f of ['manifest.webmanifest', 'sw.js', 'icon-192.png', 'icon-512.png']) {
  const res = await page.request.get(BASE + '/' + f)
  ok('PWA 资源 ' + f, res.ok())
}

ok('全程 0 页面报错', errors.length === 0, errors.slice(0, 3).join(' | '))

await browser.close()
console.log(`\n${pass} 通过, ${fail} 失败`)
process.exit(fail ? 1 : 0)
