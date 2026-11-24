import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { persistPlugin } from './stores/persist'
import './styles/global.css'
import './styles/mobile.css'

const app = createApp(App)
const pinia = createPinia()
pinia.use(persistPlugin)

app.use(pinia)
app.use(router)
app.mount('#app')

// PWA：生产环境注册 Service Worker（离线可用）
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  })
}
