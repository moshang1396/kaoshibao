import { ref } from 'vue'

// 全局共享的移动端标记（≤768px 视为手机/窄屏）
const mq = window.matchMedia('(max-width: 768px)')
export const isMobile = ref(mq.matches)

mq.addEventListener('change', (e) => { isMobile.value = e.matches })
