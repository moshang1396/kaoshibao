<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBankStore } from '../stores/banks'
import { useSessionStore } from '../stores/sessions'
import { isObjective, answerToText, correctAnswerText } from '../utils/grading'
import AnswerInput from '../components/AnswerInput.vue'
import TypeBadge from '../components/TypeBadge.vue'
import { isMobile } from '../composables/isMobile'

const route = useRoute()
const router = useRouter()
const bankStore = useBankStore()
const sessionStore = useSessionStore()

const sessionId = route.params.sessionId
const session = computed(() => sessionStore.sessionById(sessionId))

if (!session.value || session.value.status !== 'active') {
  router.replace(session.value?.mode === 'practice' && session.value?.status === 'done'
    ? `/practice/summary/${sessionId}`
    : '/')
}

const index = computed(() => session.value?.currentIndex ?? 0)
const question = computed(() => {
  if (!session.value) return null
  return bankStore.questionById(session.value.questionIds[index.value]) || null
})
const rec = computed(() => (question.value ? session.value?.answers[question.value.id] : null))

// 当前题的作答值（切换题目时重置为已保存值或空）
// 注意：这些声明必须放在下方 immediate watch 之前，否则回调执行时变量尚处于暂时性死区
const curAnswer = ref(null)
const justSubmitted = ref(false)

watch([() => question.value?.id, sessionId], () => {
  curAnswer.value = rec.value ? JSON.parse(JSON.stringify(rec.value.userAnswer ?? null)) : null
  justSubmitted.value = false
}, { immediate: true })

function onSubmit(answer) {
  if (!question.value || rec.value) return
  justSubmitted.value = true
  const correct = sessionStore.submitPracticeAnswer(sessionId, question.value, answer)
  // 答对：默认立即跳下一题（可在练习配置中关闭）；最后一题停留展示反馈
  if (
    correct === true &&
    session.value.config?.autoNext !== false &&
    index.value < session.value.questionIds.length - 1
  ) {
    next()
  }
}

function selfEval(correct) {
  if (!question.value) return
  sessionStore.selfEvalPractice(sessionId, question.value, correct)
}

// 切换题目时，让当前题号圆圈自动滚入答题卡可视区
watch(index, () => {
  document.querySelector('.sheet-dot.current')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
})

// ===== 自由导航 =====
const isLast = computed(() => session.value ? index.value >= session.value.questionIds.length - 1 : false)

function prev() {
  if (index.value > 0) sessionStore.jumpPractice(sessionId, index.value - 1)
  scrollTo(0, 0)
}

function next() {
  if (isLast.value) {
    sessionStore.endSession(sessionId)
    router.push(`/practice/summary/${sessionId}`)
  } else {
    sessionStore.jumpPractice(sessionId, index.value + 1)
    scrollTo(0, 0)
  }
}

function jumpTo(i) {
  sessionStore.jumpPractice(sessionId, i)
  scrollTo(0, 0)
}

function quit() {
  if (confirm('中途退出吗？已答的进度会保存，可从首页继续。')) {
    router.push('/')
  }
}

const showReference = computed(() => {
  if (!question.value || !rec.value) return false
  return !isObjective(question.value.type)
})

const objective = computed(() => question.value && isObjective(question.value.type))

// ===== 答题卡 =====
// 手机端默认收起（底部抽屉形式），桌面端默认展开
const sheetOpen = ref(!isMobile.value)
const total = computed(() => session.value?.questionIds.length ?? 0)
const answeredCount = computed(() =>
  session.value ? Object.keys(session.value.answers).length : 0
)
const rightCount = computed(() =>
  session.value ? Object.values(session.value.answers).filter((a) => a.correct === true).length : 0
)
const wrongCount = computed(() =>
  session.value ? Object.values(session.value.answers).filter((a) => a.correct === false).length : 0
)
const pendingCount = computed(() =>
  session.value ? Object.values(session.value.answers).filter((a) => a.correct === null || a.correct === undefined).length : 0
)

// 每个题号圆圈的状态：ok / wrong / pending / blank + current
function dotState(i) {
  const qid = session.value?.questionIds[i]
  const a = qid ? session.value?.answers[qid] : null
  if (!a || a.correct === undefined) return { cls: 'blank' }
  if (a.correct === true) return { cls: 'ok' }
  if (a.correct === false) return { cls: 'wrong' }
  return { cls: 'pending' } // 主观题待自评
}
</script>

<template>
  <div v-if="session && question" class="run-row">
    <!-- 题目区 -->
    <div class="card main-col">
      <div class="spread mb">
        <div class="row">
          <TypeBadge :type="question.type" />
          <span class="muted small">第 {{ index + 1 }} / {{ session.questionIds.length }} 题</span>
          <span v-for="t in question.tags" :key="t" class="chip tag">{{ t }}</span>
        </div>
        <div class="row">
          <button class="btn sm" @click="sheetOpen = !sheetOpen">{{ sheetOpen ? '收起答题卡 ▲' : '答题卡 ▼' }}</button>
          <button class="btn sm exit-btn" @click="quit">✕ 退出练习</button>
        </div>
      </div>

      <div class="progress-track mb">
        <div class="progress-fill" :style="{ width: ((index + 1) / session.questionIds.length) * 100 + '%' }"></div>
      </div>

      <p class="stem">{{ question.stem }}</p>

      <AnswerInput
        :q="question"
        v-model="curAnswer"
        mode="practice"
        :locked="!!rec"
        :is-correct="rec ? rec.correct : null"
        @submit="onSubmit"
      />

      <!-- 反馈区 -->
      <div v-if="rec" class="feedback mt">
        <template v-if="objective && rec.correct === true">
          <div class="alert ok">✅ 回答正确</div>
          <div v-if="question.explanation" class="explanation-box">
            <b>解析</b><br />{{ question.explanation }}
          </div>
        </template>

        <template v-if="objective && rec.correct === false">
          <div class="alert err">❌ 回答错误</div>
          <div class="ans-compare mb">
            <div>你的答案：<b class="wrong-text">{{ answerToText(question, rec.userAnswer) }}</b></div>
            <div>正确答案：<b class="right-text">{{ correctAnswerText(question) }}</b></div>
          </div>
          <div v-if="question.explanation" class="explanation-box">
            <b>解析</b><br />{{ question.explanation }}
          </div>
        </template>

        <template v-if="showReference">
          <div v-if="rec.correct === null" class="alert info">📝 对照参考答案，给自己判分</div>
          <div class="explanation-box mb">
            <b>参考答案</b><br />{{ correctAnswerText(question) }}
          </div>
          <div v-if="rec.correct === null" class="row">
            <button class="btn" @click="selfEval(true)">✅ 我答对了</button>
            <button class="btn danger" @click="selfEval(false)">❌ 我答错了</button>
          </div>
          <div v-else-if="rec.correct === true" class="alert ok">✅ 已标记为答对</div>
          <div v-else class="alert err">❌ 已标记为答错</div>
        </template>
      </div>

      <!-- 底部导航：上一题 / 下一题 自由切换 -->
      <div class="spread mt nav-row">
        <button class="btn" :disabled="index === 0" @click="prev">← 上一题</button>
        <span class="muted small">已答 {{ answeredCount }} / {{ total }}</span>
        <button class="btn primary" @click="next">
          {{ isLast ? '完成，查看小结' : '下一题 →' }}
        </button>
      </div>
    </div>

    <!-- 手机端答题卡抽屉的遮罩 -->
    <div v-if="isMobile && sheetOpen" class="sheet-mask" @click="sheetOpen = false"></div>

    <!-- 答题卡侧栏 -->
    <aside v-show="sheetOpen" class="card sheet">
      <div class="spread" style="margin-bottom: 10px">
        <h3 style="margin: 0; font-size: 15px">答题卡</h3>
        <span class="muted small">点击跳题</span>
      </div>
      <div class="sheet-grid">
        <button
          v-for="(qid, i) in session.questionIds"
          :key="qid"
          class="sheet-dot"
          :class="[dotState(i).cls, { current: i === index }]"
          @click="jumpTo(i)"
        >{{ i + 1 }}</button>
      </div>
      <div class="muted small mt" style="line-height: 2">
        <span class="dot d-ok"></span> 答对 {{ rightCount }} &nbsp;
        <span class="dot d-wrong"></span> 答错 {{ wrongCount }} &nbsp;
        <span class="dot d-pending"></span> 待自评 {{ pendingCount }} &nbsp;
        <span class="dot d-blank"></span> 未答 {{ total - answeredCount }}
      </div>
    </aside>
  </div>

  <div v-else class="card empty">
    <p>题目不存在（可能题库已被删除）</p>
    <button class="btn" @click="router.push('/')">返回首页</button>
  </div>
</template>

<style scoped>
.run-row { display: flex; gap: 14px; align-items: flex-start; }
.main-col { flex: 1; min-width: 0; }
.sheet {
  width: 264px; flex: none; position: sticky; top: 80px;
  display: flex; flex-direction: column;
  max-height: calc(100vh - 100px);
}
.sheet-grid {
  flex: 1; min-height: 120px;
  display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px;
  align-content: start;
  overflow-y: auto; padding-right: 4px;
}
.sheet-grid::-webkit-scrollbar { width: 6px; }
.sheet-grid::-webkit-scrollbar-thumb { background: #c8cfdd; border-radius: 3px; }
.sheet-grid::-webkit-scrollbar-thumb:hover { background: #a9b3c7; }
.sheet-grid::-webkit-scrollbar-track { background: transparent; }
.sheet-dot {
  width: 36px; height: 36px; border-radius: 50%;
  border: 1px solid var(--border); background: #fff; color: var(--text);
  font-size: 13px; cursor: pointer; padding: 0;
  display: flex; align-items: center; justify-content: center;
  transition: transform .1s;
}
.sheet-dot:hover { transform: scale(1.1); }
.sheet-dot.ok { background: var(--green); border-color: var(--green); color: #fff; }
.sheet-dot.wrong { background: var(--red); border-color: var(--red); color: #fff; }
.sheet-dot.pending { background: var(--orange-weak); border-color: var(--orange); color: var(--orange); }
.sheet-dot.blank { color: var(--muted); }
.sheet-dot.current { box-shadow: 0 0 0 2px #fff, 0 0 0 4px var(--primary); }
.dot { display: inline-block; width: 12px; height: 12px; border-radius: 50%; vertical-align: middle; }
.d-ok { background: var(--green); }
.d-wrong { background: var(--red); }
.d-pending { background: var(--orange-weak); border: 1px solid var(--orange); }
.d-blank { background: #fff; border: 1px solid var(--border); }
.nav-row { align-items: center; }
.exit-btn { color: var(--red); border-color: var(--red); background: var(--red-weak); }
.exit-btn:hover { background: var(--red); color: #fff; }
.stem { font-size: 16px; font-weight: 600; margin: 4px 0 16px; white-space: pre-wrap; }
.progress-track { height: 6px; background: #edf0f6; border-radius: 3px; overflow: hidden; }
.progress-fill { height: 100%; background: var(--primary); border-radius: 3px; transition: width .3s; }
.ans-compare { background: #f8f9fc; border-radius: 10px; padding: 10px 16px; font-size: 14px; }
.wrong-text { color: var(--red); }
.right-text { color: var(--green); }
@media (max-width: 900px) {
  .run-row { flex-direction: column; }
  .sheet { position: static; width: 100%; }
}
/* ===== 手机端：答题卡变底部抽屉，导航条固定底部 ===== */
@media (max-width: 768px) {
  .sheet-mask {
    position: fixed; inset: 0; background: rgba(31, 36, 48, .45); z-index: 90;
  }
  .sheet {
    position: fixed; left: 0; right: 0; bottom: 0; top: auto;
    width: 100%; max-height: 62vh; margin: 0; z-index: 95;
    border-radius: 18px 18px 0 0;
    box-shadow: 0 -8px 30px rgba(31, 36, 48, .25);
    padding-bottom: calc(14px + env(safe-area-inset-bottom));
  }
  .sheet-dot { width: 42px; height: 42px; font-size: 14px; }
  .nav-row {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 80;
    margin: 0; flex-wrap: nowrap;
    background: #fff; border-top: 1px solid var(--border);
    padding: 10px 14px calc(10px + env(safe-area-inset-bottom));
  }
  .nav-row .btn { flex: 1; }
  .nav-row .muted { flex: none; }
  .spread { row-gap: 8px; }
  .exit-btn { padding: 6px 10px; font-size: 13px; }
}
</style>
