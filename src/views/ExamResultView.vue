<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBankStore } from '../stores/banks'
import { useSessionStore } from '../stores/sessions'
import { isObjective, answerToText, correctAnswerText, typeLabel, gradeAnswer } from '../utils/grading'
import AnswerInput from '../components/AnswerInput.vue'
import TypeBadge from '../components/TypeBadge.vue'
import BarStat from '../components/BarStat.vue'

const route = useRoute()
const router = useRouter()
const bankStore = useBankStore()
const sessionStore = useSessionStore()

const sessionId = route.params.sessionId
const session = computed(() => sessionStore.sessionById(sessionId))
if (!session.value) {
  router.replace('/')
} else if (session.value.status === 'active') {
  // 考试尚未交卷 → 回到答题页
  router.replace(`/exam/run/${sessionId}`)
}

const score = computed(() => session.value?.score)
const passLineScore = computed(() =>
  score.value ? Math.round((score.value.full * session.value.config.passLine) / 100) : 0
)
const passed = computed(() => score.value && score.value.total >= passLineScore.value)

const usedMs = computed(() => (session.value?.submittedAt ?? 0) - (session.value?.startedAt ?? 0))
const usedText = computed(() => {
  const m = Math.round(usedMs.value / 60000)
  return `${Math.floor(m / 60)} 小时 ${m % 60} 分钟`.replace(/^0 小时 /, '')
})

const questions = computed(() =>
  (session.value?.questionIds || []).map((id) => bankStore.questionById(id)).filter(Boolean)
)

function recOf(qid) {
  return session.value?.answers[qid] || { userAnswer: null, marked: false, selfMark: null }
}
function isRight(q) {
  const r = recOf(q.id)
  if (isObjective(q.type)) {
    return gradeAnswer(q, r.userAnswer)
  }
  return r.selfMark === true
}

// 待自评主观题
const pendingSelfEval = computed(() =>
  questions.value.filter((q) => !isObjective(q.type) && recOf(q.id).selfMark == null)
)

function selfEval(q, correct) {
  sessionStore.selfEvalExam(sessionId, q.id, correct)
}

// 错题
const wrongQuestions = computed(() => questions.value.filter((q) => isRight(q) === false))

// 各题型正确率
const typeStat = computed(() => {
  const stat = {}
  for (const q of questions.value) {
    const r = isRight(q)
    if (r == null) continue
    if (!stat[q.type]) stat[q.type] = { correct: 0, total: 0 }
    stat[q.type].total++
    if (r) stat[q.type].correct++
  }
  return stat
})

function retake() {
  router.push(`/exam/config/${session.value.bankId}`)
}
</script>

<template>
  <div v-if="session && score">
    <!-- 成绩单 -->
    <div class="card score-hero" :class="passed ? 'pass' : 'fail'">
      <div class="spread">
        <div>
          <h3 style="margin: 0 0 4px">{{ session.bankName }} · 考试成绩</h3>
          <span class="muted small">
            {{ session.autoSubmitted ? '⏰ 时间到自动交卷' : '已交卷' }} · 用时 {{ usedText }} · 及格线 {{ passLineScore }} 分
          </span>
        </div>
        <div class="score-num">
          <span class="big" :class="passed ? 'c-pass' : 'c-fail'">{{ score.total }}</span>
          <span class="muted">/ {{ score.full }}</span>
          <div class="pass-tag" :class="passed ? 'c-pass' : 'c-fail'">{{ passed ? '🎉 及格' : '未及格' }}</div>
        </div>
      </div>
      <div class="row mt small" style="gap: 18px">
        <span>客观题：<b>{{ score.objective }}</b> / {{ score.objectiveFull }} 分</span>
        <span v-if="score.subjectiveFull > 0">
          主观题（自评）：<b>{{ score.subjective }}</b> / {{ score.subjectiveFull }} 分
        </span>
      </div>
    </div>

    <!-- 待自评 -->
    <div v-if="pendingSelfEval.length" class="card">
      <h3>📝 待自评的主观题（{{ pendingSelfEval.length }} 题）</h3>
      <p class="muted small mb">对照参考答案给自己判分：答对按该题满分计入，答错计 0 分。</p>
      <div v-for="q in pendingSelfEval" :key="q.id" class="eval-block">
        <div class="row mb" style="align-items: flex-start">
          <TypeBadge :type="q.type" />
          <span class="small" style="flex: 1">{{ q.stem }}</span>
        </div>
        <div class="ans-compare mb">
          <div>你的答案：<b>{{ answerToText(q, recOf(q.id).userAnswer) }}</b></div>
        </div>
        <div class="explanation-box mb"><b>参考答案</b><br />{{ correctAnswerText(q) }}</div>
        <div class="row">
          <button class="btn" @click="selfEval(q, true)">✅ 答对（计满分）</button>
          <button class="btn danger" @click="selfEval(q, false)">❌ 答错（计 0 分）</button>
        </div>
      </div>
    </div>

    <!-- 题型正确率 -->
    <div class="card">
      <h3>📊 各题型正确率</h3>
      <BarStat
        v-for="(st, t) in typeStat"
        :key="t"
        :label="typeLabel(t)"
        :percent="Math.round((st.correct / st.total) * 100)"
        :detail="`${st.correct} / ${st.total} 正确`"
      />
    </div>

    <!-- 错题 -->
    <div class="card">
      <h3>❌ 错题（{{ wrongQuestions.length }}）<span class="muted small">已自动加入错题本</span></h3>
      <div v-if="!wrongQuestions.length" class="empty" style="padding: 16px">全部答对，漂亮！🎉</div>
      <div v-for="q in wrongQuestions" :key="q.id" class="wrong-block">
        <div class="row mb" style="align-items: flex-start">
          <TypeBadge :type="q.type" />
          <span class="small" style="flex: 1">{{ q.stem }}</span>
        </div>
        <div class="ans-compare mb">
          <div>你的答案：<b class="c-fail-text">{{ answerToText(q, recOf(q.id).userAnswer) }}</b></div>
          <div>正确答案：<b class="c-pass-text">{{ correctAnswerText(q) }}</b></div>
        </div>
        <div v-if="q.explanation" class="explanation-box">{{ q.explanation }}</div>
      </div>
    </div>

    <!-- 整卷回顾 -->
    <div class="card">
      <h3>📖 整卷回顾（{{ questions.length }} 题）</h3>
      <details v-for="(q, i) in questions" :key="q.id" class="review-item">
        <summary>
          <span class="num">{{ i + 1 }}</span>
          <TypeBadge :type="q.type" />
          <span class="stem-clip">{{ q.stem }}</span>
          <span class="tag-res" :class="isRight(q) ? 'ok' : 'bad'">{{ isRight(q) ? '✓' : '✗' }}</span>
        </summary>
        <div class="ans-compare mt">
          <div>你的答案：<b>{{ answerToText(q, recOf(q.id).userAnswer) }}</b></div>
          <div>正确答案：<b>{{ correctAnswerText(q) }}</b></div>
        </div>
        <div v-if="q.explanation" class="explanation-box mt">{{ q.explanation }}</div>
      </details>
    </div>

    <div class="row" style="justify-content: center">
      <button class="btn primary lg" @click="retake">🔄 再考一次</button>
      <button class="btn lg" @click="router.push('/wrong')">查看错题本</button>
      <button class="btn ghost lg" @click="router.push('/')">返回首页</button>
    </div>
  </div>
</template>

<style scoped>
.score-hero { border-left: 5px solid var(--border); }
.score-hero.pass { border-left-color: var(--green); }
.score-hero.fail { border-left-color: var(--red); }
.score-num { text-align: center; }
.score-num .big { font-size: 44px; font-weight: 800; font-variant-numeric: tabular-nums; }
.c-pass { color: var(--green); }
.c-fail { color: var(--red); }
.c-pass-text { color: var(--green); }
.c-fail-text { color: var(--red); }
.pass-tag { font-size: 14px; font-weight: 700; }
.ans-compare { background: #f8f9fc; border-radius: 10px; padding: 10px 16px; font-size: 14px; }
.eval-block, .wrong-block { border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; margin-bottom: 12px; }
.review-item { border-bottom: 1px dashed var(--border); padding: 8px 0; }
.review-item summary { display: flex; align-items: center; gap: 10px; cursor: pointer; list-style: none; }
.review-item summary::-webkit-details-marker { display: none; }
.review-item .num { color: var(--muted); font-size: 13px; flex: none; width: 26px; text-align: right; }
.review-item .stem-clip { flex: 1; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.review-item .tag-res { font-weight: 800; }
.review-item .tag-res.ok { color: var(--green); }
.review-item .tag-res.bad { color: var(--red); }
</style>
