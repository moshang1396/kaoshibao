<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useBankStore } from '../stores/banks'
import { useSessionStore } from '../stores/sessions'
import { QUESTION_TYPES } from '../utils/types'
import BackupModal from '../components/BackupModal.vue'

const router = useRouter()
const bankStore = useBankStore()
const sessionStore = useSessionStore()

const showBackup = ref(false)

const banks = computed(() => bankStore.banks)
const unfinished = computed(() => sessionStore.unfinished)

function continueSession(s) {
  if (s.mode === 'practice') router.push(`/practice/run/${s.id}`)
  else if (s.mode === 'memorize') router.push(`/memorize/run/${s.id}`)
  else router.push(`/exam/run/${s.id}`)
}

const modeLabel = (m) => (m === 'practice' ? '练习' : m === 'memorize' ? '背题' : '考试')

function sessionProgress(s) {
  const answered = Object.keys(s.answers).length
  return `${answered} / ${s.questionIds.length}`
}

function loadDemo() {
  bankStore.loadDemoBank()
}

// 删除一条未完成的答题进度
function delSession(s) {
  const prog = sessionProgress(s)
  if (confirm(`删除「${s.bankName}」的答题进度（已完成 ${prog}）？删除后不可恢复。`)) {
    sessionStore.deleteSession(s.id)
  }
}

function delBank(b) {
  if (confirm(`确定删除题库「${b.name}」？该题库全部题目将被删除（答题记录保留）。`)) {
    bankStore.deleteBank(b.id)
  }
}

function typeStat(bankId) {
  const stat = bankStore.typeCountOf(bankId)
  return QUESTION_TYPES.filter((t) => stat[t.key]).map((t) => ({ ...t, n: stat[t.key] }))
}
</script>

<template>
  <!-- 未完成的场次 -->
  <div v-if="unfinished.length" class="card">
    <h3>⏳ 继续答题</h3>
    <div
      v-for="s in unfinished"
      :key="s.id"
      class="spread"
      style="padding: 8px 0; border-bottom: 1px dashed var(--border)"
    >
      <div>
        <span class="chip" :class="s.mode === 'practice' ? 't-single' : s.mode === 'memorize' ? 't-apply' : 't-judge'">
          {{ modeLabel(s.mode) }}
        </span>
        <strong>{{ s.bankName }}</strong>
        <span class="muted small">已完成 {{ sessionProgress(s) }}</span>
      </div>
      <div class="row" style="flex: none">
        <button class="btn sm primary" @click="continueSession(s)">继续</button>
        <button class="btn ghost danger sm" @click="delSession(s)">删除</button>
      </div>
    </div>
  </div>

  <!-- 顶部操作 -->
  <div class="card">
    <div class="spread">
      <div>
        <h3 style="margin-bottom: 4px">我的题库</h3>
        <span class="muted small">通过模板导入题目，或载入示例题库直接体验</span>
      </div>
      <div class="row">
        <button class="btn primary" @click="router.push('/import')">📥 导入题库</button>
        <button class="btn" @click="loadDemo">✨ 载入示例题库</button>
        <button class="btn" @click="showBackup = true">💾 备份/迁移</button>
      </div>
    </div>
  </div>

  <!-- 数据备份弹窗 -->
  <BackupModal v-if="showBackup" @close="showBackup = false" />

  <!-- 题库列表 -->
  <div v-if="banks.length" class="bank-grid">
    <div v-for="b in banks" :key="b.id" class="card bank-card">
      <div class="spread">
        <h3 style="margin: 0">{{ b.name }}</h3>
        <span class="muted small">{{ bankStore.countOf(b.id) }} 题</span>
      </div>
      <div class="row mt" style="margin-bottom: 4px">
        <span v-for="t in typeStat(b.id)" :key="t.key" class="chip" :class="'t-' + t.key">
          {{ t.short }} {{ t.n }}
        </span>
      </div>
      <div class="row mt">
        <button class="btn primary" @click="router.push(`/practice/config/${b.id}`)">✏️ 练习</button>
        <button class="btn" @click="router.push(`/practice/config/${b.id}?mode=memorize`)">📖 背题</button>
        <button class="btn" @click="router.push(`/exam/config/${b.id}`)">⏱ 模拟考试</button>
        <button class="btn ghost danger sm" style="margin-left: auto" @click="delBank(b)">删除</button>
      </div>
    </div>
  </div>

  <div v-else class="card empty">
    <div class="big">📚</div>
    <p>还没有题库，先导入一份题目，或载入示例题库试试</p>
    <div class="row" style="justify-content: center">
      <button class="btn primary lg" @click="router.push('/import')">📥 导入题库</button>
      <button class="btn lg" @click="loadDemo">✨ 载入示例题库</button>
    </div>
  </div>
</template>

<style scoped>
.bank-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 14px;
}
.bank-card { margin-bottom: 0; display: flex; flex-direction: column; }
</style>
