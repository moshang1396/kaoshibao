<script setup>
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBankStore } from '../stores/banks'
import { useSessionStore } from '../stores/sessions'
import { QUESTION_TYPES } from '../utils/types'

const route = useRoute()
const router = useRouter()
const bankStore = useBankStore()
const sessionStore = useSessionStore()

const bankId = route.params.bankId
const bank = bankStore.bankById(bankId)
if (!bank) router.replace('/')

const allQs = computed(() => bankStore.questionsOf(bankId))
const typeStat = computed(() => bankStore.typeCountOf(bankId))
const presentTypes = computed(() => QUESTION_TYPES.filter((t) => typeStat.value[t.key]))

const cfg = reactive({
  pickMode: 'random',      // random | byType
  randomCount: 20,
  typeCounts: Object.fromEntries(QUESTION_TYPES.map((t) => [t.key, 0])),
  durationMin: 30,
  passLine: 60,
  scoreMode: 'uniform',    // uniform | byType
  uniformValue: 2,
  points: { single: 1, multi: 2, judge: 1, fill: 2, short: 5, apply: 5, draw: 5 }
})

// 随机抽题的题型范围（空 = 全部题型）
const pickedTypes = ref([])
function toggleType(key) {
  const i = pickedTypes.value.indexOf(key)
  i >= 0 ? pickedTypes.value.splice(i, 1) : pickedTypes.value.push(key)
}

// 随机抽题的题目池（应用题型筛选后）
const randomPool = computed(() =>
  pickedTypes.value.length ? allQs.value.filter((q) => pickedTypes.value.includes(q.type)) : allQs.value
)

function allOfType(type) {
  return allQs.value.filter((q) => q.type === type)
}

const pickedCount = computed(() => {
  if (cfg.pickMode === 'random') {
    return Math.min(cfg.randomCount || 0, randomPool.value.length)
  }
  return presentTypes.value.reduce((sum, t) => sum + Math.min(cfg.typeCounts[t.key] || 0, typeStat.value[t.key]), 0)
})

function questionPoints(q) {
  return cfg.scoreMode === 'uniform' ? (cfg.uniformValue || 0) : (cfg.points[q.type] ?? 1)
}

const fullScore = computed(() => {
  let total = 0
  if (cfg.pickMode === 'random') {
    // 随机模式暂按全库平均估分（每题按统一分值或各题型分值）
    const n = pickedCount.value
    if (cfg.scoreMode === 'uniform') return n * (cfg.uniformValue || 0)
    const avg = randomPool.value.length
      ? randomPool.value.reduce((s, q) => s + questionPoints(q), 0) / randomPool.value.length
      : 0
    return Math.round(n * avg)
  }
  for (const t of presentTypes.value) {
    const n = Math.min(cfg.typeCounts[t.key] || 0, typeStat.value[t.key])
    total += n * (cfg.scoreMode === 'uniform' ? (cfg.uniformValue || 0) : (cfg.points[t.key] ?? 1))
  }
  return total
})

const canStart = computed(() => pickedCount.value > 0 && cfg.durationMin > 0)

const passLineCalc = computed(() => Math.round((fullScore.value * cfg.passLine) / 100) || 0)

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function buildQuestionIds() {
  if (cfg.pickMode === 'random') {
    return shuffle(randomPool.value).slice(0, pickedCount.value).map((q) => q.id)
  }
  const ids = []
  for (const t of presentTypes.value) {
    const n = Math.min(cfg.typeCounts[t.key] || 0, typeStat.value[t.key])
    if (n > 0) ids.push(...shuffle(allOfType(t.key)).slice(0, n).map((q) => q.id))
  }
  return ids
}

function start() {
  const ids = buildQuestionIds()
  if (!ids.length) return
  const sid = sessionStore.startExam({
    bankId,
    bankName: bank.name,
    questionIds: ids,
    config: {
      durationMin: cfg.durationMin,
      passLine: cfg.passLine,
      scoreRule: {
        mode: cfg.scoreMode,
        value: Number(cfg.uniformValue) || 1,
        points: { ...cfg.points }
      }
    }
  })
  router.push(`/exam/run/${sid}`)
}
</script>

<template>
  <div v-if="bank" class="card">
    <div class="spread">
      <div>
        <h3 style="margin-bottom: 2px">⏱ 考试配置</h3>
        <span class="muted">{{ bank.name }} · 共 {{ allQs.length }} 题</span>
      </div>
      <div class="row">
        <span v-for="t in presentTypes" :key="t.key" class="chip" :class="'t-' + t.key">
          {{ t.short }} {{ typeStat[t.key] }}
        </span>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="form-item">
      <label>抽题方式</label>
      <div class="radio-row">
        <span class="radio-chip" :class="{ on: cfg.pickMode === 'random' }" @click="cfg.pickMode = 'random'">随机抽题</span>
        <span class="radio-chip" :class="{ on: cfg.pickMode === 'byType' }" @click="cfg.pickMode = 'byType'">按题型自定义数量</span>
      </div>
    </div>

    <div v-if="cfg.pickMode === 'random'" class="form-item">
      <label>题型范围<span class="muted small">（不选 = 全部题型）</span></label>
      <div class="radio-row mb">
        <span
          v-for="t in presentTypes"
          :key="t.key"
          class="radio-chip"
          :class="{ on: pickedTypes.includes(t.key) }"
          @click="toggleType(t.key)"
        >{{ t.label }}（{{ typeStat[t.key] }}）</span>
        <span v-if="pickedTypes.length" class="radio-chip clear-chip" @click="pickedTypes = []">✕ 清除</span>
      </div>
      <label>抽题数量</label>
      <div class="row">
        <input v-model.number="cfg.randomCount" type="number" min="1" :max="randomPool.length" style="width: 110px" />
        <span class="muted small">当前范围共 {{ randomPool.length }} 题</span>
      </div>
    </div>

    <div v-else class="form-item">
      <label>各题型抽题数量</label>
      <div class="type-count-row" v-for="t in presentTypes" :key="t.key">
        <span class="chip" :class="'t-' + t.key">{{ t.label }}</span>
        <input v-model.number="cfg.typeCounts[t.key]" type="number" min="0" :max="typeStat[t.key]" style="width: 90px" />
        <span class="muted small">可抽 {{ typeStat[t.key] }} 题</span>
        <button class="btn ghost sm" @click="cfg.typeCounts[t.key] = typeStat[t.key]">全部</button>
      </div>
    </div>

    <div class="form-item">
      <label>考试时长（分钟）</label>
      <input v-model.number="cfg.durationMin" type="number" min="1" style="width: 110px" />
    </div>

    <div class="form-item">
      <label>及格线（占总分百分比）</label>
      <div class="row">
        <input v-model.number="cfg.passLine" type="number" min="1" max="100" style="width: 110px" />
        <span class="muted small">%</span>
      </div>
    </div>

    <div class="form-item">
      <label>分值规则</label>
      <div class="radio-row mb">
        <span class="radio-chip" :class="{ on: cfg.scoreMode === 'uniform' }" @click="cfg.scoreMode = 'uniform'">统一分值</span>
        <span class="radio-chip" :class="{ on: cfg.scoreMode === 'byType' }" @click="cfg.scoreMode = 'byType'">按题型分值</span>
      </div>
      <div v-if="cfg.scoreMode === 'uniform'" class="row">
        每题
        <input v-model.number="cfg.uniformValue" type="number" min="1" style="width: 90px" /> 分
      </div>
      <div v-else class="row">
        <div v-for="t in presentTypes" :key="t.key" class="row small" style="margin-right: 14px">
          {{ t.short }}
          <input v-model.number="cfg.points[t.key]" type="number" min="1" style="width: 76px" /> 分
        </div>
      </div>
    </div>

    <div class="spread" style="background: #f8f9fc; border-radius: 10px; padding: 12px 16px">
      <div>
        <b>{{ pickedCount }}</b> 题 · 总分 <b>{{ fullScore }}</b> 分
        <span class="muted small">（及格线 {{ passLineCalc }} 分）</span>
      </div>
      <button class="btn primary lg" :disabled="!canStart" @click="start">开始考试</button>
    </div>
  </div>
</template>

<style scoped>
.type-count-row { display: flex; align-items: center; gap: 10px; padding: 6px 0; flex-wrap: wrap; }
.clear-chip { color: var(--red); border-color: var(--red); }
</style>
