import { createRouter, createWebHashHistory } from 'vue-router'

// 使用 hash 路由：build 后 dist/index.html 可直接双击离线打开
const routes = [
  { path: '/', name: 'home', component: () => import('../views/HomeView.vue') },
  { path: '/import', name: 'import', component: () => import('../views/ImportView.vue') },
  { path: '/practice/config/:bankId', name: 'practice-config', component: () => import('../views/PracticeConfigView.vue') },
  { path: '/practice/run/:sessionId', name: 'practice-run', component: () => import('../views/PracticeRunView.vue') },
  { path: '/practice/summary/:sessionId', name: 'practice-summary', component: () => import('../views/PracticeSummaryView.vue') },
  { path: '/memorize/run/:sessionId', name: 'memorize-run', component: () => import('../views/MemorizeRunView.vue') },
  { path: '/exam/config/:bankId', name: 'exam-config', component: () => import('../views/ExamConfigView.vue') },
  { path: '/exam/run/:sessionId', name: 'exam-run', component: () => import('../views/ExamRunView.vue') },
  { path: '/exam/result/:sessionId', name: 'exam-result', component: () => import('../views/ExamResultView.vue') },
  { path: '/wrong', name: 'wrong', component: () => import('../views/WrongBookView.vue') },
  { path: '/stats', name: 'stats', component: () => import('../views/StatsView.vue') },
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

export default createRouter({
  history: createWebHashHistory(),
  routes
})
