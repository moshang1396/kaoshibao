<script setup>
import { computed, ref, watch } from 'vue'
import { useBankStore } from '../stores/banks'
import { useSessionStore } from '../stores/sessions'
import { useWrongBookStore } from '../stores/wrongbook'
import { typeLabel } from '../utils/grading'
import BarStat from '../components/BarStat.vue'

const sessionStore = useSessionStore()
const bankStore = useBankStore()
const wrongBookStore = useWrongBookStore()

// ===== 题库隔离切换：'all' 或某题库 id =====
const banks = computed(() => bankStore.banks)
const scope = ref('all')

watch(banks, (list) => {
  if (scope.value !== 'all' && !list.some((b) => b.id === scope.value)) {
    scope.value = 'all'
  }
})

const isAll = computed(() => scope.value === 'all')
const currentBank = computed(() => (isAll.value ? null : bankStore.bankById(scope.value)))

const totals = computed(() =>
  isAll.value ? sessionStore.statTotals : sessionStore.statTotalsOfBank(scope.value)
)
const streak = computed(() =>
  isAll.value ? sessionStore.streakDays : sessionStore.streakDaysOfBank(scope.value)
)
const wrongCount = computed(() =>
  isAll.value ? wrongBookStore.count : wrongBookStore.countOfBank(scope.value)
)

const typeStat = computed(() => {
  const logs = isAll.value ? sessionStore.logs : sessionStore.logsOfBank(scope.value)
  const stat = {}
  for (const l of logs) {
    if (l.correct !== true && l.correct !== false) continue
    if (!stat[l.type]) stat[l.type] = { correct: 0, total: 0 }
    stat[l.type].total++
    if (l.correct) stat[l.type].correct++
  }
  return stat
})
const typeEntries = computed(() => Object.entries(typeStat.value))

const recentExams = computed(() =>
  isAll.value ? sessionStore.recentExams : sessionStore.recentExamsOfBank(scope.value)
)

function fmtTime(ts) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
function examPass(s) {
  const line = Math.round((s.score.full * s.config.passLine) / 100)
  return s.score.total >= line
}
</script>

<template>
  <!-- 题库切换 -->
  <div class="card" style="padding: 12px 20px">
    <div class="row bank-tabs-row" style="flex-wrap: wrap; gap: 8px">
      <span class="bank-tab" :class="{ on: isAll }" @click="scope = 'all'">🌐 全部题库</span>
      <span
        v-for="b in banks"
        :key="b.id"
        class="bank-tab"
        :class="{ on: b.id === scope }"
        @click="scope = b.id"
      >{{ b.name }}</span>
    </div>
  </div>

  <div class="card">
    <h3>📊 学习统计{{ currentBank ? ' · ' + currentBank.name : '' }}</h3>
    <div class="stat-grid">
      <div class="stat-card"><div class="num">{{ totals.answered }}</div><div class="lbl">累计答题</div></div>
      <div class="stat-card"><div class="num">{{ totals.accuracy }}%</div><div class="lbl">总正确率（{{ totals.graded }} 题已判分）</div></div>
      <div class="stat-card"><div class="num" style="color: var(--red)">{{ wrongCount }}</div><div class="lbl">错题本</div></div>
      <div class="stat-card"><div class="num" style="color: var(--orange)">{{ streak }}</div><div class="lbl">连续学习天数</div></div>
    </div>
  </div>

  <div class="card">
    <h3>各题型正确率</h3>
    <div v-if="!typeEntries.length" class="muted small">还没有答题记录</div>
    <BarStat
      v-for="[t, st] in typeEntries"
      :key="t"
      :label="typeLabel(t)"
      :percent="Math.round((st.correct / st.total) * 100)"
      :detail="`${st.correct} / ${st.total} 正确`"
    />
  </div>

  <div class="card">
    <h3>最近考试成绩</h3>
    <div v-if="!recentExams.length" class="muted small">还没有完成过考试</div>
    <div v-for="s in recentExams" :key="s.id" class="exam-row">
      <div>
        <b class="small">{{ s.bankName }}</b>
        <div class="muted small">{{ fmtTime(s.submittedAt) }}<template v-if="s.autoSubmitted"> · 超时自动交卷</template></div>
      </div>
      <div class="row" style="flex: none">
        <b :style="{ color: examPass(s) ? 'var(--green)' : 'var(--red)' }" style="font-size: 18px">
          {{ s.score.total }}<span class="muted" style="font-size: 12px"> / {{ s.score.full }}</span>
        </b>
        <span class="chip" :class="examPass(s) ? 't-single' : 't-fill'">{{ examPass(s) ? '及格' : '未及格' }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.exam-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 0; border-bottom: 1px dashed var(--border);
}
.exam-row:last-child { border-bottom: none; }
.bank-tab {
  display: inline-flex; align-items: center;
  padding: 6px 14px; border-radius: 999px; cursor: pointer;
  border: 1.5px solid var(--border); background: #fff; color: var(--text);
  font-size: 13px; max-width: 320px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.bank-tab.on { border-color: var(--primary); background: var(--primary-weak); color: var(--primary); font-weight: 600; }
</style>
