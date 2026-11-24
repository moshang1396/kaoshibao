<script setup>
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBankStore } from '../stores/banks'
import { useSessionStore } from '../stores/sessions'
import { useWrongBookStore } from '../stores/wrongbook'
import { QUESTION_TYPES } from '../utils/types'

const route = useRoute()
const router = useRouter()
const bankStore = useBankStore()
const sessionStore = useSessionStore()
const wrongBookStore = useWrongBookStore()

const bankId = route.params.bankId
const bank = bankStore.bankById(bankId)
if (!bank) router.replace('/')

const total = computed(() => bankStore.countOf(bankId))
const typeStat = computed(() => bankStore.typeCountOf(bankId))
const presentTypes = computed(() => QUESTION_TYPES.filter((t) => typeStat.value[t.key]))

// 题库内出现过的全部标签（如章节、卷别）
const allTags = computed(() => {
  const set = new Set()
  for (const q of bankStore.questionsOf(bankId)) for (const t of q.tags || []) set.add(t)
  return [...set]
})

// 该题库内的错题（来自独立错题库）
const bankWrongIds = computed(() => wrongBookStore.entriesOfBank(bankId).map((e) => e.qid))

const cfg = reactive({
  mode: route.query.mode === 'memorize' ? 'memorize' : 'practice', // practice | memorize
  range: 'all',            // all | wrong
  order: 'sequential',     // sequential | random | byType
  count: null,             // null = 全部
  autoNext: true           // 答对后自动跳下一题
})
const selectedTypes = ref([])   // 按题型筛选（空 = 不限）
const selectedTags = ref([])    // 按标签筛选（空 = 不限）

function toggleIn(arr, val) {
  const i = arr.indexOf(val)
  i >= 0 ? arr.splice(i, 1) : arr.push(val)
}

// 依次应用：范围 → 题型 → 标签
const poolQs = computed(() => {
  let qs = cfg.range === 'wrong'
    ? bankStore.questionsOf(bankId).filter((q) => bankWrongIds.value.includes(q.id))
    : bankStore.questionsOf(bankId)
  if (selectedTypes.value.length) qs = qs.filter((q) => selectedTypes.value.includes(q.type))
  if (selectedTags.value.length) qs = qs.filter((q) => (q.tags || []).some((t) => selectedTags.value.includes(t)))
  return qs
})

const poolSize = computed(() => poolQs.value.length)
const countInput = computed({
  get: () => (cfg.count == null ? poolSize.value : cfg.count),
  set: (v) => { cfg.count = v }
})

function buildQuestionIds() {
  let ids = poolQs.value.map((q) => q.id)
  if (cfg.order === 'random') {
    ids.sort(() => Math.random() - 0.5)
  } else if (cfg.order === 'byType') {
    const orderKey = Object.fromEntries(QUESTION_TYPES.map((t, i) => [t.key, i]))
    const rank = {}
    bankStore.questionsOf(bankId).forEach((q, i) => { rank[q.id] = i })
    ids.sort((a, b) => {
      const qa = bankStore.questionById(a)
      const qb = bankStore.questionById(b)
      return (orderKey[qa?.type] ?? 99) - (orderKey[qb?.type] ?? 99) || rank[a] - rank[b]
    })
  }
  const n = Math.min(cfg.count == null ? ids.length : cfg.count, ids.length)
  return ids.slice(0, n)
}

function start() {
  const ids = buildQuestionIds()
  if (!ids.length) return
  const shared = {
    bankId,
    bankName: bank.name,
    questionIds: ids,
    config: { range: cfg.range, order: cfg.order, autoNext: cfg.autoNext }
  }
  let sid
  if (cfg.mode === 'memorize') {
    sid = sessionStore.startMemorize(shared)
    router.push(`/memorize/run/${sid}`)
  } else {
    sid = sessionStore.startPractice(shared)
    router.push(`/practice/run/${sid}`)
  }
}

const canStart = computed(() => poolSize.value > 0)

const modeLabel = computed(() => (cfg.mode === 'memorize' ? '背题' : '练习'))
</script>

<template>
  <div v-if="bank" class="card">
    <div class="spread">
      <div>
        <h3 style="margin-bottom: 2px">✏️ {{ modeLabel }}配置</h3>
        <span class="muted">{{ bank.name }} · 共 {{ total }} 题</span>
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
      <label>模式</label>
      <div class="radio-row">
        <span class="radio-chip" :class="{ on: cfg.mode === 'practice' }" @click="cfg.mode = 'practice'">✏️ 答题练习</span>
        <span class="radio-chip" :class="{ on: cfg.mode === 'memorize' }" @click="cfg.mode = 'memorize'">📖 背题模式</span>
      </div>
      <div class="muted small mt" style="margin-top: 6px">
        {{ cfg.mode === 'memorize'
          ? '直接显示答案与解析，快速过题背诵；不留答题记录，不影响错题本和统计'
          : '答题后立即判分，答错显示正确答案与解析' }}
      </div>
    </div>

    <div class="form-item">
      <label>出题范围</label>
      <div class="radio-row">
        <span class="radio-chip" :class="{ on: cfg.range === 'all' }" @click="cfg.range = 'all'; cfg.count = null">
          全部题目（{{ total }}）
        </span>
        <span
          class="radio-chip"
          :class="{ on: cfg.range === 'wrong' }"
          @click="cfg.range = 'wrong'; cfg.count = null"
        >只练错题（{{ bankWrongIds.length }}）</span>
      </div>
    </div>

    <div v-if="presentTypes.length" class="form-item">
      <label>按题型筛选<span class="muted small">（不选 = 全部题型）</span></label>
      <div class="radio-row">
        <span
          v-for="t in presentTypes"
          :key="t.key"
          class="radio-chip"
          :class="{ on: selectedTypes.includes(t.key) }"
          @click="toggleIn(selectedTypes, t.key)"
        >{{ t.label }}（{{ typeStat[t.key] }}）</span>
        <span v-if="selectedTypes.length" class="radio-chip clear-chip" @click="selectedTypes = []">✕ 清除</span>
      </div>
    </div>

    <div v-if="allTags.length" class="form-item">
      <label>按标签筛选<span class="muted small">（章节 / 卷别等，不选 = 全部）</span></label>
      <div class="radio-row">
        <span
          v-for="tag in allTags"
          :key="tag"
          class="radio-chip"
          :class="{ on: selectedTags.includes(tag) }"
          @click="toggleIn(selectedTags, tag)"
        >{{ tag }}</span>
        <span v-if="selectedTags.length" class="radio-chip clear-chip" @click="selectedTags = []">✕ 清除</span>
      </div>
    </div>

    <div class="form-item">
      <label>出题顺序</label>
      <div class="radio-row">
        <span class="radio-chip" :class="{ on: cfg.order === 'sequential' }" @click="cfg.order = 'sequential'">顺序刷题</span>
        <span class="radio-chip" :class="{ on: cfg.order === 'random' }" @click="cfg.order = 'random'">随机打乱</span>
        <span class="radio-chip" :class="{ on: cfg.order === 'byType' }" @click="cfg.order = 'byType'">按题型分组</span>
      </div>
    </div>

    <div class="form-item">
      <label>{{ modeLabel }}数量</label>
      <div class="row">
        <input v-model.number="countInput" type="number" min="1" :max="poolSize" style="width: 110px" />
        <span class="muted small">可{{ modeLabel }} {{ poolSize }} 题</span>
      </div>
    </div>

    <div v-if="cfg.mode === 'practice'" class="form-item">
      <label>答题选项</label>
      <label class="switch-row">
        <input v-model="cfg.autoNext" type="checkbox" />
        <span>答对后自动跳下一题<span class="muted small">（关闭后答对也会停留，方便看解析）</span></span>
      </label>
    </div>

    <button class="btn primary lg" :disabled="!canStart" @click="start">
      {{ canStart ? `开始${modeLabel}（${Math.min(cfg.count == null ? poolSize : cfg.count, poolSize)} 题）` : '该范围暂无题目' }}
    </button>
  </div>
</template>

<style scoped>
.clear-chip { color: var(--red); border-color: var(--red); }
.switch-row {
  display: flex; align-items: center; gap: 8px; cursor: pointer;
  font-size: 14px; color: var(--text);
}
.switch-row input { width: 17px; height: 17px; accent-color: var(--primary); cursor: pointer; }
</style>
