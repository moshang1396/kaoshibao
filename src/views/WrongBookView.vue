<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useBankStore } from '../stores/banks'
import { useSessionStore } from '../stores/sessions'
import { useWrongBookStore } from '../stores/wrongbook'
import { answerToText, correctAnswerText } from '../utils/grading'
import TypeBadge from '../components/TypeBadge.vue'

const router = useRouter()
const bankStore = useBankStore()
const sessionStore = useSessionStore()
const wrongBookStore = useWrongBookStore()

// ===== 题库隔离：切换当前查看的题库 =====
const banks = computed(() => bankStore.banks)
const selectedBankId = ref(banks.value[0]?.id || '')

// 题库被删除后，其错题（快照）仍保留在独立库中——归入"已删除题库"分组
const orphanEntries = computed(() => {
  const ids = new Set(banks.value.map((b) => b.id))
  return wrongBookStore.entries.filter((e) => !ids.has(e.bankId))
})

// 题库列表变化（删除等）时保证选中项有效
watch(banks, (list, old) => {
  const wentOrphan = old && old.some((b) => b.id === selectedBankId.value) && !list.some((b) => b.id === selectedBankId.value)
  if (wentOrphan) selectedBankId.value = '__orphan__'
  else if (!list.some((b) => b.id === selectedBankId.value) && selectedBankId.value !== '__orphan__') {
    selectedBankId.value = list[0]?.id || (orphanEntries.value.length ? '__orphan__' : '')
  }
})

const wrongCountOf = (bankId) => wrongBookStore.countOfBank(bankId)

const isOrphan = computed(() => selectedBankId.value === '__orphan__')
const wrongList = computed(() => {
  if (isOrphan.value) return [...orphanEntries.value].sort((a, b) => b.wrongAt - a.wrongAt)
  return selectedBankId.value ? wrongBookStore.entriesOfBank(selectedBankId.value) : []
})
const currentBank = computed(() => (isOrphan.value ? null : bankStore.bankById(selectedBankId.value)))
const count = computed(() => wrongList.value.length)

// 最近一次是否答对（显示"已巩固"提示；答题记录删除后此提示自然消失，不影响错题本身）
function recentlyPassed(e) {
  const logs = sessionStore.logsOfQuestion(e.qid)
  return logs.length && logs[logs.length - 1].correct === true
}

function removeQ(e) {
  if (confirm('确定将这道题移出错题本？')) {
    wrongBookStore.removeWrong(e.qid)
  }
}

function retrain() {
  if (!currentBank.value || !count.value) return
  const ids = wrongList.value.map((e) => e.qid).filter((qid) => bankStore.questionById(qid))
  if (!ids.length) {
    alert('错题对应的题目已不在当前题库中，无法重练')
    return
  }
  // 随机打乱组卷（归属当前题库）
  const shuffled = [...ids].sort(() => Math.random() - 0.5)
  const sid = sessionStore.startPractice({
    bankId: currentBank.value.id,
    bankName: currentBank.value.name + ' · 错题重练',
    questionIds: shuffled,
    config: { range: 'wrong', order: 'random' }
  })
  router.push(`/practice/run/${sid}`)
}

function fmtDate(ts) {
  const d = new Date(ts)
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
</script>

<template>
  <!-- 题库切换 -->
  <div class="card" style="padding: 12px 20px">
    <div class="row bank-tabs-row" style="flex-wrap: wrap; gap: 8px">
      <span
        v-for="b in banks"
        :key="b.id"
        class="bank-tab"
        :class="{ on: b.id === selectedBankId }"
        @click="selectedBankId = b.id"
      >
        {{ b.name }}
        <span class="badge-n" :class="{ nonzero: wrongCountOf(b.id) }">{{ wrongCountOf(b.id) }}</span>
      </span>
      <span
        v-if="orphanEntries.length"
        class="bank-tab"
        :class="{ on: isOrphan }"
        @click="selectedBankId = '__orphan__'"
      >
        🗑 已删除题库
        <span class="badge-n" :class="{ nonzero: orphanEntries.length }">{{ orphanEntries.length }}</span>
      </span>
    </div>
  </div>

  <div v-if="currentBank || isOrphan" class="card">
    <div class="spread">
      <div>
        <h3 style="margin-bottom: 2px">❌ 错题本 · {{ isOrphan ? '已删除题库' : currentBank.name }}</h3>
        <span class="muted small">共 {{ count }} 题 · 独立错题库：删除答题记录或题库不影响错题，答错自动收进，手动移除</span>
      </div>
      <button v-if="!isOrphan" class="btn primary" :disabled="!count" @click="retrain">🔄 错题重练</button>
    </div>
  </div>

  <div v-if="!wrongBookStore.count" class="card empty">
    <div class="big">🎉</div>
    <p>错题本是空的，去练习或考试中答几题试试</p>
    <div class="row" style="justify-content: center">
      <button class="btn primary" @click="router.push('/')">🏠 回首页</button>
    </div>
  </div>

  <div v-else-if="!count" class="card empty">
    <div class="big">🎉</div>
    <p>「{{ isOrphan ? '已删除题库' : currentBank?.name }}」的错题本是空的，继续保持！</p>
  </div>

  <div v-for="e in wrongList" :key="e.qid" class="card wrong-card">
    <div class="spread">
      <div class="row" style="align-items: flex-start">
        <TypeBadge :type="e.type" />
        <span class="small" style="flex: 1">{{ e.stem }}</span>
      </div>
      <div class="row" style="flex: none">
        <span v-if="recentlyPassed(e)" class="chip t-judge">最近答对</span>
        <span v-if="e.timesWrong > 1" class="chip t-single">错 {{ e.timesWrong }} 次</span>
        <button class="btn ghost danger sm" @click="removeQ(e)">移除</button>
      </div>
    </div>
    <div class="muted small mt">{{ e.bankName || '（原题库已删除）' }} · 最近答错于 {{ fmtDate(e.wrongAt) }}</div>

    <details class="mt">
      <summary class="muted small" style="cursor: pointer">查看答案与解析 ▾</summary>
      <div class="ans-compare mt">
        <div>最近作答：<b>{{ answerToText(e, e.lastUserAnswer) }}</b></div>
        <div>正确答案：<b style="color: var(--green)">{{ correctAnswerText(e) }}</b></div>
      </div>
      <div v-if="e.explanation" class="explanation-box mt">{{ e.explanation }}</div>
    </details>
  </div>
</template>

<style scoped>
.wrong-card { padding: 14px 20px; }
.ans-compare { background: #f8f9fc; border-radius: 10px; padding: 10px 16px; font-size: 14px; }
details summary::-webkit-details-marker { display: none; }
.bank-tab {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 14px; border-radius: 999px; cursor: pointer;
  border: 1.5px solid var(--border); background: #fff; color: var(--text);
  font-size: 13px; max-width: 320px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.bank-tab.on { border-color: var(--primary); background: var(--primary-weak); color: var(--primary); font-weight: 600; }
.badge-n {
  min-width: 20px; height: 20px; padding: 0 6px; border-radius: 10px;
  background: #eef1f6; color: var(--muted); font-size: 12px;
  display: inline-flex; align-items: center; justify-content: center;
}
.badge-n.nonzero { background: var(--red); color: #fff; }
</style>
