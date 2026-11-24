<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBankStore } from '../stores/banks'
import { useSessionStore } from '../stores/sessions'
import AnswerInput from '../components/AnswerInput.vue'
import TypeBadge from '../components/TypeBadge.vue'
import { isMobile } from '../composables/isMobile'

const route = useRoute()
const router = useRouter()
const bankStore = useBankStore()
const sessionStore = useSessionStore()

const sessionId = route.params.sessionId
const session = computed(() => sessionStore.sessionById(sessionId))

// 过期未交卷 → 自动交卷并跳成绩单
if (!session.value || session.value.status !== 'active') {
  router.replace(session.value?.mode === 'exam' && session.value?.status === 'done'
    ? `/exam/result/${sessionId}`
    : '/')
}

const index = ref(session.value?.currentIndex ?? 0)
const question = computed(() => {
  if (!session.value) return null
  return bankStore.questionById(session.value.questionIds[index.value]) || null
})
const rec = computed(() => (question.value ? session.value?.answers[question.value.id] : null))

// 当前题作答值
const curAnswer = computed({
  get: () => rec.value?.userAnswer ?? null,
  set: (v) => sessionStore.setExamAnswer(sessionId, question.value.id, v)
})

// ===== 倒计时 =====
const now = ref(Date.now())
let timer = setInterval(() => { now.value = Date.now() }, 500)
onBeforeUnmount(() => clearInterval(timer))

const remainMs = computed(() => Math.max(0, (session.value?.endsAt ?? 0) - now.value))
const timeText = computed(() => {
  const s = Math.floor(remainMs.value / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(sec).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
})
const urgent = computed(() => remainMs.value > 0 && remainMs.value <= 5 * 60 * 1000)

// 倒计时归零 → 自动交卷
function checkAutoSubmit() {
  if (session.value?.status === 'active' && session.value.endsAt <= Date.now()) {
    submit(true)
  }
}

const answeredCount = computed(() =>
  session.value ? Object.values(session.value.answers).filter((a) => a.userAnswer != null && a.userAnswer !== '' && (Array.isArray(a.userAnswer) ? a.userAnswer.length : true)).length : 0
)

// ===== 答题卡 =====
// 手机端默认收起（底部抽屉形式），桌面端默认展开
const sheetOpen = ref(!isMobile.value)
// 切换题目时，让当前题号自动滚入答题卡可视区
watch(index, () => {
  document.querySelector('.sheet-cell.current')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
})
function sheetItem(i) {
  const qid = session.value.questionIds[i]
  const a = session.value.answers[qid]
  const has = a && a.userAnswer != null && a.userAnswer !== '' && (Array.isArray(a.userAnswer) ? a.userAnswer.length > 0 : true)
  return { has: !!has, marked: !!a?.marked, current: i === index.value }
}
function jump(i) { index.value = i; scrollTo(0, 0) }

// ===== 交卷 =====
const showSubmit = ref(false)
function submit(auto = false) {
  if (!session.value || session.value.status !== 'active') return
  sessionStore.submitExam(sessionId, { auto })
  clearInterval(timer)
  router.push(`/exam/result/${sessionId}`)
}

// 定时检查超时自动交卷
let autoChecker = setInterval(() => checkAutoSubmit(), 1000)
onBeforeUnmount(() => clearInterval(autoChecker))

function prev() { if (index.value > 0) index.value-- }
function next() { if (index.value < session.value.questionIds.length - 1) index.value++ }

function toggleMark() {
  if (question.value) sessionStore.toggleMark(sessionId, question.value.id)
}
const isMarked = computed(() => !!rec.value?.marked)
</script>

<template>
  <div v-if="session && question">
    <!-- 顶部状态条 -->
    <div class="card exam-top">
      <div class="spread">
        <div class="row">
          <span class="chip t-judge">考试</span>
          <strong>{{ session.bankName }}</strong>
          <span class="muted small">已答 {{ answeredCount }} / {{ session.questionIds.length }}</span>
        </div>
        <div class="row">
          <div class="timer" :class="{ urgent }">{{ urgent ? '⏰ ' : '⏱ ' }}{{ timeText }}</div>
          <button class="btn primary" @click="showSubmit = true">交卷</button>
        </div>
      </div>
    </div>

    <div class="row" style="align-items: flex-start">
      <!-- 题目区 -->
      <div class="card" style="flex: 1; min-width: 300px; margin-bottom: 0">
        <div class="spread mb">
          <div class="row">
            <TypeBadge :type="question.type" />
            <span class="muted small">第 {{ index + 1 }} / {{ session.questionIds.length }} 题</span>
          </div>
          <button
            class="btn sm"
            :class="isMarked ? 'danger' : ''"
            :style="isMarked ? 'background: var(--orange-weak); border-color: var(--orange); color: var(--orange)' : ''"
            @click="toggleMark"
          >{{ isMarked ? '★ 已存疑' : '☆ 标记存疑' }}</button>
        </div>

        <p class="stem">{{ question.stem }}</p>

        <AnswerInput :q="question" v-model="curAnswer" mode="exam" />

        <div class="spread mt nav-row">
          <button class="btn" :disabled="index === 0" @click="prev">← 上一题</button>
          <button class="btn primary" :disabled="index >= session.questionIds.length - 1" @click="next">下一题 →</button>
        </div>
      </div>

      <!-- 手机端答题卡抽屉的遮罩 -->
      <div v-if="isMobile && sheetOpen" class="sheet-mask" @click="sheetOpen = false"></div>

      <!-- 答题卡 -->
      <div class="card sheet" style="width: 300px; flex: none">
        <div class="spread" style="cursor: pointer" @click="sheetOpen = !sheetOpen">
          <h3 style="margin: 0; font-size: 15px">答题卡</h3>
          <span class="muted small">{{ sheetOpen ? '收起 ▲' : '展开 ▼' }}</span>
        </div>
        <div v-show="sheetOpen" class="mt sheet-body">
          <div class="sheet-grid">
            <div
              v-for="(item, i) in session.questionIds.length"
              :key="i"
              class="sheet-cell"
              :class="[{ answered: sheetItem(i).has, marked: sheetItem(i).marked, current: sheetItem(i).current }]"
              @click="jump(i)"
            >
              {{ i + 1 }}
              <span v-if="sheetItem(i).marked" class="star">★</span>
            </div>
          </div>
          <div class="muted small mt" style="line-height: 1.9">
            <span class="dot d-answered"></span> 已答 &nbsp;
            <span class="dot d-marked"></span> 存疑 &nbsp;
            <span class="dot d-blank"></span> 未答
          </div>
        </div>
      </div>
    </div>

    <!-- 交卷确认 -->
    <div v-if="showSubmit" class="modal-mask" @click.self="showSubmit = false">
      <div class="modal">
        <h4>确认交卷？</h4>
        <p class="muted">
          已答 <b>{{ answeredCount }}</b> 题，
          <template v-if="answeredCount < session.questionIds.length">
            还有 <b style="color: var(--orange)">{{ session.questionIds.length - answeredCount }}</b> 题未作答，未答题按错误计分。
          </template>
          <template v-else>全部题目已作答。</template>
        </p>
        <div class="btns">
          <button class="btn" @click="showSubmit = false">继续答题</button>
          <button class="btn primary" @click="submit(false)">确认交卷</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.exam-top { position: sticky; top: 66px; z-index: 40; padding: 12px 20px; }
.timer {
  font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums;
  color: var(--text); background: #f0f2f7; border-radius: 8px; padding: 4px 12px;
}
.timer.urgent { color: var(--red); background: var(--red-weak); animation: pulse 1s infinite; }
@keyframes pulse { 50% { opacity: .6; } }
.stem { font-size: 16px; font-weight: 600; margin: 4px 0 16px; white-space: pre-wrap; }
.sheet { position: sticky; top: 130px; display: flex; flex-direction: column; max-height: calc(100vh - 150px); }
.sheet-body { flex: 1; min-height: 0; overflow-y: auto; padding-right: 4px; }
.sheet-body::-webkit-scrollbar { width: 6px; }
.sheet-body::-webkit-scrollbar-thumb { background: #c8cfdd; border-radius: 3px; }
.sheet-body::-webkit-scrollbar-thumb:hover { background: #a9b3c7; }
.sheet-body::-webkit-scrollbar-track { background: transparent; }
.dot { display: inline-block; width: 12px; height: 12px; border-radius: 4px; vertical-align: middle; }
.d-answered { background: var(--primary-weak); border: 1px solid var(--primary); }
.d-marked { background: var(--orange); }
.d-blank { background: #fff; border: 1px solid var(--border); }
@media (max-width: 860px) {
  .row { flex-direction: column; align-items: stretch; }
  .sheet { position: static; width: 100% !important; }
}
/* ===== 手机端：答题卡变底部抽屉，导航条固定底部 ===== */
@media (max-width: 768px) {
  .exam-top { top: 58px; padding: 10px 12px; }
  .timer { font-size: 17px; padding: 3px 10px; }
  .sheet-mask {
    position: fixed; inset: 0; background: rgba(31, 36, 48, .45); z-index: 90;
  }
  .sheet {
    position: fixed; left: 0; right: 0; bottom: 0; top: auto;
    width: 100% !important; max-height: 62vh; margin: 0; z-index: 95;
    border-radius: 18px 18px 0 0;
    box-shadow: 0 -8px 30px rgba(31, 36, 48, .25);
    padding-bottom: calc(14px + env(safe-area-inset-bottom));
  }
  .sheet-cell { width: 44px; height: 40px; }
  .nav-row {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 80;
    margin: 0; flex-wrap: nowrap; background: #fff;
    border-top: 1px solid var(--border);
    padding: 10px 14px calc(10px + env(safe-area-inset-bottom));
  }
  .nav-row .btn { flex: 1; }
}
</style>
