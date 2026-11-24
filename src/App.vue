<script setup>
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useSessionStore } from './stores/sessions'
import { useBankStore } from './stores/banks'
import { useWrongBookStore } from './stores/wrongbook'
import { isMobile } from './composables/isMobile'

const route = useRoute()
const sessionStore = useSessionStore()
const wrongBookStore = useWrongBookStore()

// 独立错题本计数（与答题记录解耦，删除记录不影响）
const wrongCount = computed(() => wrongBookStore.count)

// 启动时：恢复过期未交卷的考试场次 + 迁移旧版错题数据到独立库
onMounted(() => {
  sessionStore.recoverExpired()
  wrongBookStore.migrateFrom(sessionStore, useBankStore())
})

const navs = [
  { to: '/', label: '首页', icon: '🏠' },
  { to: '/import', label: '导入', icon: '📥' },
  { to: '/wrong', label: '错题本', icon: '❌' },
  { to: '/stats', label: '统计', icon: '📊' }
]

// 答题页（练习/考试/背题）隐藏底部标签栏，避免与底部导航条重叠
const showTabs = computed(
  () => !['/practice/run/', '/exam/run/', '/memorize/run/'].some((p) => route.path.startsWith(p))
)
const activeNav = (to) => route.path === to || (to !== '/' && route.path.startsWith(to))
</script>

<template>
  <header class="app-header">
    <div class="inner">
      <router-link to="/" class="logo" style="color: inherit; text-decoration: none">📝 考试宝</router-link>
      <nav class="nav">
        <router-link
          v-for="n in navs"
          :key="n.to"
          :to="n.to"
          :class="{ active: activeNav(n.to) }"
        >
          {{ n.label }}
          <span v-if="n.to === '/wrong' && wrongCount" class="badge">{{ wrongCount }}</span>
        </router-link>
      </nav>
    </div>
  </header>

  <main class="container">
    <router-view />
  </main>

  <!-- 手机端底部标签栏 -->
  <nav v-show="isMobile && showTabs" class="bottom-tabs">
    <router-link v-for="n in navs" :key="n.to" :to="n.to" :class="{ active: activeNav(n.to) }">
      <span class="t-icon">{{ n.icon }}</span>
      <span>{{ n.label }}</span>
      <span v-if="n.to === '/wrong' && wrongCount" class="badge">{{ wrongCount }}</span>
    </router-link>
  </nav>
</template>
