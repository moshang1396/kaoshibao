<script setup>
// 背题模式：直接显示题目与答案，快速过题背诵
// - 不判分、不留答题记录，只记录"已浏览"用于答题卡
// - 答案默认显示，可一键隐藏用于自测
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBankStore } from '../stores/banks'
import { useSessionStore } from '../stores/sessions'
import { correctAnswerText, isObjective } from '../utils/grading'
import { OPTION_LETTERS } from '../utils/types'
import TypeBadge from '../components/TypeBadge.vue'
import { isMobile } from '../composables/isMobile'

const route = useRoute()
const router = useRouter()
const bankStore = useBankStore()
const sessionStore = useSessionStore()

const sessionId = route.params.sessionId
const session = computed(() => sessionStore.sessionById(sessionId))

if (!session.value || session.value.mode !== 'memorize') {
  router.replace('/')
}

const index = computed(() => session.value?.currentIndex ?? 0)
const question = computed(() => {
  if (!session.value) return null
  return bankStore.questionById(session.value.questionIds[index.value]) || null
})

const showAns = ref(true)

// 当前题标记为已浏览
watch(() => question.value?.id, (qid) => {
  if (qid) sessionStore.markViewed(sessionId, qid)
}, { immediate: true })

const isLast = computed(() => session.value ? index.value >= session.value.questionIds.length - 1 : false)
const viewedCount = computed(() => session.value?.viewedIds.length ?? 0)
const total = computed(() => session.value?.questionIds.length ?? 0)

const isChoice = computed(() => question.value && ['single', 'multi', 'judge'].includes(question.value.type))
const correctSet = computed(() => {
  const a = question.value?.answer
  return Array.isArray(a) ? a : []
})

function optClass(i) {
  return correctSet.value.includes(i) ? 'correct' : ''
}

// ===== 导航 =====
function prev() {
  if (index.value > 0) sessionStore.jumpPractice(sessionId, index.value - 1)
  scrollTo(0, 0)
}
function next() {
  if (isLast.value) {
    sessionStore.endSession(sessionId)
    router.push('/')
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
  if (confirm('退出背题吗？浏览进度会保存，可从首页继续。')) {
    router.push('/')
  }
}

// ===== 答题卡 =====
// 手机端默认收起（底部抽屉形式），桌面端默认展开
const sheetOpen = ref(!isMobile.value)
function dotState(i) {
  const qid = session.value?.questionIds[i]
  return session.value?.viewedIds.includes(qid) ? 'viewed' : 'blank'
}
</script>

<template>
  <div v-if="session && question" class="run-row">
    <!-- 题目区 -->
    <div class="card main-col">
      <div class="spread mb">
        <div class="row">
          <span class="chip t-apply">背题</span>
          <TypeBadge :type="question.type" />
          <span class="muted small">第 {{ index + 1 }} / {{ session.questionIds.length }} 题</span>
          <span v-for="t in question.tags" :key="t" class="chip tag">{{ t }}</span>
        </div>
        <div class="row">
          <button class="btn sm" @click="showAns = !showAns">{{ showAns ? '🙈 隐藏答案' : '👁 显示答案' }}</button>
          <button class="btn sm" @click="sheetOpen = !sheetOpen">{{ sheetOpen ? '收起答题卡 ▲' : '答题卡 ▼' }}</button>
          <button class="btn sm exit-btn" @click="quit">✕ 退出背题</button>
        </div>
      </div>

      <div class="progress-track mb">
        <div class="progress-fill" :style="{ width: ((index + 1) / session.questionIds.length) * 100 + '%' }"></div>
      </div>

      <p class="stem">{{ question.stem }}</p>

      <!-- 选项：正确项绿色高亮 -->
      <div v-if="isChoice" class="mem-opts" :class="{ hidden: !showAns }">
        <div v-for="(opt, i) in question.options" :key="i" class="mem-opt" :class="optClass(i)">
          <span class="letter">{{ OPTION_LETTERS[i] }}</span>
          <span>{{ opt }}</span>
          <span v-if="correctSet.includes(i)" class="tick">✔</span>
        </div>
      </div>

      <!-- 答案区 -->
      <div v-if="showAns" class="ans-area">
        <div class="ans-line">
          <b>答案：</b><b class="right-text">{{ correctAnswerText(question) }}</b>
        </div>
        <div v-if="question.explanation" class="explanation-box">
          <b>解析</b><br />{{ question.explanation }}
        </div>
        <div v-if="!isObjective(question.type)" class="muted small" style="margin-top: 8px">
          主观题：先自己想一想/写一写，再对照参考答案效果更好
        </div>
      </div>
      <div v-else class="ans-area muted small" style="padding: 14px">
        答案已隐藏——先在心里作答，再点上方「👁 显示答案」对照
      </div>

      <!-- 底部导航 -->
      <div class="spread mt nav-row">
        <button class="btn" :disabled="index === 0" @click="prev">← 上一题</button>
        <span class="muted small">已看 {{ viewedCount }} / {{ total }}</span>
        <button class="btn primary" @click="next">{{ isLast ? '完成背题' : '下一题 →' }}</button>
      </div>
    </div>

    <!-- 手机端答题卡抽屉的遮罩 -->
    <div v-if="isMobile && sheetOpen" class="sheet-mask" @click="sheetOpen = false"></div>

    <!-- 答题卡 -->
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
          :class="[dotState(i), { current: i === index }]"
          @click="jumpTo(i)"
        >{{ i + 1 }}</button>
      </div>
      <div class="muted small mt" style="line-height: 2">
        <span class="dot d-viewed"></span> 已看 {{ viewedCount }} &nbsp;
        <span class="dot d-blank"></span> 未看 {{ total - viewedCount }}
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
.sheet { width: 264px; flex: none; position: sticky; top: 80px; display: flex; flex-direction: column; max-height: calc(100vh - 100px); }
.sheet-grid { flex: 1; min-height: 120px; display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; align-content: start; overflow-y: auto; padding-right: 4px; }
.sheet-grid::-webkit-scrollbar { width: 6px; }
.sheet-grid::-webkit-scrollbar-thumb { background: #c8cfdd; border-radius: 3px; }
.sheet-dot { width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--border); background: #fff; color: var(--text); font-size: 13px; cursor: pointer; padding: 0; display: flex; align-items: center; justify-content: center; transition: transform .1s; }
.sheet-dot:hover { transform: scale(1.1); }
.sheet-dot.viewed { background: var(--green); border-color: var(--green); color: #fff; }
.sheet-dot.blank { color: var(--muted); }
.sheet-dot.current { box-shadow: 0 0 0 2px #fff, 0 0 0 4px var(--primary); }
.dot { display: inline-block; width: 12px; height: 12px; border-radius: 50%; vertical-align: middle; }
.d-viewed { background: var(--green); }
.d-blank { background: #fff; border: 1px solid var(--border); }
.exit-btn { color: var(--red); border-color: var(--red); background: var(--red-weak); }
.exit-btn:hover { background: var(--red); color: #fff; }
.nav-row { align-items: center; }
.stem { font-size: 16px; font-weight: 600; margin: 4px 0 16px; white-space: pre-wrap; }
.progress-track { height: 6px; background: #edf0f6; border-radius: 3px; overflow: hidden; }
.progress-fill { height: 100%; background: var(--primary); border-radius: 3px; transition: width .3s; }
.mem-opts { display: flex; flex-direction: column; gap: 10px; }
.mem-opts.hidden { filter: blur(6px); user-select: none; pointer-events: none; }
.mem-opt {
  display: flex; align-items: center; gap: 10px;
  border: 1.5px solid var(--border); border-radius: 10px; padding: 10px 14px;
  background: #fff; font-size: 14px;
}
.mem-opt.correct { border-color: var(--green); background: var(--green-weak); }
.mem-opt .tick { margin-left: auto; color: var(--green); font-weight: 700; }
.ans-area { margin-top: 14px; }
.ans-line { padding: 10px 14px; background: var(--green-weak); border-radius: 10px; margin-bottom: 10px; }
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
}
</style>
