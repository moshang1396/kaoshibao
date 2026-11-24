<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBankStore } from '../stores/banks'
import { useSessionStore } from '../stores/sessions'
import TypeBadge from '../components/TypeBadge.vue'

const route = useRoute()
const router = useRouter()
const bankStore = useBankStore()
const sessionStore = useSessionStore()

const sessionId = route.params.sessionId
const session = computed(() => sessionStore.sessionById(sessionId))
if (!session.value) router.replace('/')

const stat = computed(() => {
  const s = session.value
  if (!s) return null
  const answers = Object.values(s.answers)
  const total = answers.length
  const correct = answers.filter((a) => a.correct === true).length
  const wrong = answers.filter((a) => a.correct === false).length
  const pending = answers.filter((a) => a.correct == null).length
  // 本次新增错题
  const newWrongIds = [...new Set(
    sessionStore.logs
      .filter((l) => l.sessionId === sessionId && l.correct === false)
      .map((l) => l.questionId)
  )]
  return { total, correct, wrong, pending, accuracy: total ? Math.round((correct / total) * 100) : 0, newWrongIds }
})

const wrongQuestions = computed(() =>
  (stat.value?.newWrongIds || [])
    .map((id) => bankStore.questionById(id))
    .filter(Boolean)
)

function again() {
  router.push(`/practice/config/${session.value.bankId}`)
}
</script>

<template>
  <div v-if="session && stat" class="card">
    <h3>📊 练习小结 · {{ session.bankName }}</h3>
    <div class="stat-grid">
      <div class="stat-card"><div class="num">{{ stat.total }}</div><div class="lbl">已答题目</div></div>
      <div class="stat-card"><div class="num" style="color: var(--green)">{{ stat.correct }}</div><div class="lbl">答对</div></div>
      <div class="stat-card"><div class="num" style="color: var(--red)">{{ stat.wrong }}</div><div class="lbl">答错</div></div>
      <div class="stat-card"><div class="num">{{ stat.accuracy }}%</div><div class="lbl">正确率</div></div>
      <div class="stat-card"><div class="num" style="color: var(--orange)">{{ stat.newWrongIds.length }}</div><div class="lbl">新增错题</div></div>
    </div>
    <div v-if="stat.pending" class="muted small mt">
      另有 {{ stat.pending }} 道主观题尚未自评，未计入正确率。
    </div>
    <div class="row mt">
      <button class="btn primary" @click="again">🔄 再练一轮</button>
      <button class="btn" @click="router.push('/wrong')">查看错题本</button>
      <button class="btn ghost" @click="router.push('/')">返回首页</button>
    </div>
  </div>

  <div v-if="wrongQuestions.length" class="card">
    <h3>❌ 本次答错的题（{{ wrongQuestions.length }}）</h3>
    <div v-for="q in wrongQuestions" :key="q.id" class="wrong-row">
      <TypeBadge :type="q.type" />
      <span class="small">{{ q.stem }}</span>
    </div>
  </div>
</template>

<style scoped>
.wrong-row { display: flex; gap: 8px; align-items: flex-start; padding: 8px 0; border-bottom: 1px dashed var(--border); }
.wrong-row:last-child { border-bottom: none; }
</style>
