// 数据备份：把全部考试宝数据（题库/场次/记录/错题本）导出为 JSON，或从 JSON 恢复
// 用途：PC 端 exe 与手机端之间迁移数据

const PREFIX = 'ksb_'

export function exportBackup() {
  const data = { app: 'kaoshibao', version: 1, exportedAt: Date.now(), stores: {} }
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k.startsWith(PREFIX)) data.stores[k] = localStorage.getItem(k)
  }
  const n = Object.keys(data.stores).length
  if (!n) { alert('没有可备份的数据'); return }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  const d = new Date()
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  a.href = URL.createObjectURL(blob)
  a.download = `考试宝备份_${ymd}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 3000)
  return n
}

export async function importBackup(file) {
  const text = await file.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('文件不是有效的 JSON')
  }
  if (data.app !== 'kaoshibao' || !data.stores || typeof data.stores !== 'object') {
    throw new Error('不是考试宝的备份文件')
  }
  const keys = Object.keys(data.stores)
  if (!keys.length) throw new Error('备份文件中没有任何数据')
  for (const k of keys) localStorage.setItem(k, data.stores[k])
  return keys.length
}
