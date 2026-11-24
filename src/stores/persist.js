// Pinia 持久化插件：每个 store 自动写入 localStorage，实现本地离线存储
const PREFIX = 'ksb_'

export function persistPlugin({ store }) {
  const key = PREFIX + store.$id + '_v1'
  // 启动时恢复
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const saved = JSON.parse(raw)
      if (saved && typeof saved === 'object') store.$patch(saved)
    }
  } catch (e) {
    console.warn('[考试宝] 本地数据恢复失败：', e)
  }
  // 变更时保存
  store.$subscribe(() => {
    try {
      localStorage.setItem(key, JSON.stringify(store.$state))
    } catch (e) {
      console.warn('[考试宝] 本地数据保存失败（可能超出存储容量）：', e)
    }
  })
}
