// 考试宝 Service Worker：缓存全部静态资源，实现 PWA 离线可用
const CACHE = 'kaoshibao-v1'

self.addEventListener('install', (e) => {
  self.skipWaiting()
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html']).catch(() => {})))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) return
  // 导航请求走网络优先，其余资源缓存优先 + 后台更新
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const cl = res.clone()
          caches.open(CACHE).then((c) => c.put('./index.html', cl))
          return res
        })
        .catch(() => caches.match('./index.html'))
    )
    return
  }
  e.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req).then((res) => {
          if (res.ok) {
            const cl = res.clone()
            caches.open(CACHE).then((c) => c.put(req, cl))
          }
          return res
        })
    )
  )
})
