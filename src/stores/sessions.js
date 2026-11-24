import { defineStore } from 'pinia'
import { genId } from '../utils/types'
import { gradeAnswer, isObjective } from '../utils/grading'
import { useBankStore } from './banks'
import { useWrongBookStore } from './wrongbook'

// ===== 统计计算（全局 / 单题库共用）=====
function calcTotals(logs) {
  const graded = logs.filter((l) => l.correct === true || l.correct === false)
  const correct = graded.filter((l) => l.correct === true).length
  return {
    answered: logs.length,
    graded: graded.length,
    correct,
    wrong: graded.length - correct,
    accuracy: graded.length ? Math.round((correct / graded.length) * 100) : 0
  }
}

function calcStreak(logs) {
  const days = [...new Set(logs.map((l) => new Date(l.at).toLocaleDateString('zh-CN')))]
  if (!days.length) return 0
  const toDay = (dstr) => {
    const [y, m, d] = dstr.split('/').map(Number)
    return new Date(y, m - 1, d).getTime()
  }
  const dayNums = days.map(toDay).sort((a, b) => b - a)
  const today = new Date()
  const todayNum = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  if (dayNums[0] < todayNum - 86400000) return 0
  let streak = 1
  for (let i = 1; i < dayNums.length; i++) {
    if (dayNums[i] === dayNums[i - 1] - 86400000) streak++
    else break
  }
  return streak
}

export const useSessionStore = defineStore('sessions', {
  state: () => ({
    sessions: [],      // 场次（练习 / 考试）
    logs: []           // 答题记录（错题本已独立到 wrongbook store，删除记录不影响错题本）
  }),

  getters: {
    sessionById: (s) => (id) => s.sessions.find((x) => x.id === id) || null,
    unfinished: (s) => s.sessions.filter((x) => x.status === 'active'),

    logsOfQuestion: (s) => (qid) => s.logs.filter((l) => l.questionId === qid),

    // 题目 id → 所属题库 id 映射（用于按题库隔离）
    qBankMap() {
      const bankStore = useBankStore()
      const map = {}
      for (const b of bankStore.banks) {
        for (const q of bankStore.questionsOf(b.id)) map[q.id] = b.id
      }
      return map
    },
    // ===== 按题库隔离 =====
    logsOfBank() {
      return (bankId) => this.logs.filter((l) => this.qBankMap[l.questionId] === bankId)
    },

    // ===== 统计 =====
    statTotals(s) {
      return calcTotals(s.logs)
    },
    statTotalsOfBank() {
      return (bankId) => calcTotals(this.logsOfBank(bankId))
    },
    streakDays(s) {
      return calcStreak(s.logs)
    },
    streakDaysOfBank() {
      return (bankId) => calcStreak(this.logsOfBank(bankId))
    },
    statByType() {
      const stat = {}
      for (const l of this.logs) {
        if (l.correct !== true && l.correct !== false) continue
        if (!stat[l.type]) stat[l.type] = { correct: 0, total: 0 }
        stat[l.type].total++
        if (l.correct) stat[l.type].correct++
      }
      return stat
    },
    recentExams(s) {
      return s.sessions
        .filter((x) => x.mode === 'exam' && x.status === 'done' && x.score)
        .sort((a, b) => b.submittedAt - a.submittedAt)
        .slice(0, 10)
    },
    recentExamsOfBank() {
      return (bankId) =>
        this.recentExams.filter((x) => x.bankId === bankId)
    }
  },

  actions: {
    // ===== 通用 =====
    _pushLog(entry) {
      this.logs.push({
        id: genId('log'),
        questionId: entry.questionId,
        type: entry.type,
        mode: entry.mode,
        sessionId: entry.sessionId,
        userAnswer: entry.userAnswer,
        correct: entry.correct, // true / false / null（主观题待自评）
        at: Date.now()
      })
    },

    // 答错 → 收进独立错题本（快照存储，与答题记录解耦）
    _collectWrong(question, sessionId, userAnswer) {
      if (!question || !sessionId) return
      const s = this.sessionById(sessionId)
      if (!s) return
      useWrongBookStore().addWrong(question, s.bankId, s.bankName, userAnswer)
    },

    // ===== 练习模式 =====
    startPractice({ bankId, bankName, questionIds, config }) {
      const session = {
        id: genId('prac'),
        mode: 'practice',
        bankId,
        bankName,
        questionIds,
        config,
        answers: {},      // { [qid]: { userAnswer, correct } }
        currentIndex: 0,
        status: 'active',
        startedAt: Date.now(),
        endedAt: null
      }
      this.sessions.push(session)
      return session.id
    },

    // ===== 背题模式（直接看答案，不判分、不留答题记录）=====
    startMemorize({ bankId, bankName, questionIds, config }) {
      const session = {
        id: genId('memo'),
        mode: 'memorize',
        bankId,
        bankName,
        questionIds,
        config,
        answers: {},
        viewedIds: [],   // 已浏览过的题目 id
        currentIndex: 0,
        status: 'active',
        startedAt: Date.now(),
        endedAt: null
      }
      this.sessions.push(session)
      return session.id
    },

    markViewed(sessionId, qid) {
      const s = this.sessionById(sessionId)
      if (s && !s.viewedIds.includes(qid)) s.viewedIds.push(qid)
    },

    submitPracticeAnswer(sessionId, question, userAnswer) {
      const s = this.sessionById(sessionId)
      if (!s) return null
      const correct = gradeAnswer(question, userAnswer)
      s.answers[question.id] = { userAnswer, correct }
      this._pushLog({
        questionId: question.id,
        type: question.type,
        mode: 'practice',
        sessionId,
        userAnswer,
        correct
      })
      if (correct === false) this._collectWrong(question, sessionId, userAnswer)
      return correct
    },

    // 主观题自评
    selfEvalPractice(sessionId, question, correct) {
      const s = this.sessionById(sessionId)
      if (!s) return
      const rec = s.answers[question.id]
      if (!rec) return
      rec.correct = correct
      // 追加一条自评记录
      this._pushLog({
        questionId: question.id,
        type: question.type,
        mode: 'practice',
        sessionId,
        userAnswer: rec.userAnswer,
        correct
      })
      if (correct === false) this._collectWrong(question, sessionId, rec.userAnswer)
    },

    nextPractice(sessionId) {
      const s = this.sessionById(sessionId)
      if (!s) return 'end'
      s.currentIndex++
      if (s.currentIndex >= s.questionIds.length) {
        s.currentIndex = s.questionIds.length - 1
        return 'end'
      }
      return 'ok'
    },

    // 自由跳转到任意题号（自由切换上一题/下一题、答题卡跳题共用）
    jumpPractice(sessionId, index) {
      const s = this.sessionById(sessionId)
      if (!s) return
      s.currentIndex = Math.max(0, Math.min(index, s.questionIds.length - 1))
    },

    endSession(sessionId) {
      const s = this.sessionById(sessionId)
      if (s) {
        s.status = 'done'
        s.endedAt = Date.now()
      }
    },

    // ===== 考试模式 =====
    startExam({ bankId, bankName, questionIds, config }) {
      const session = {
        id: genId('exam'),
        mode: 'exam',
        bankId,
        bankName,
        questionIds,
        config, // { durationMin, passLine, scoreRule: {mode, value?, points?} }
        answers: {},    // { [qid]: { userAnswer, marked, selfMark } }
        currentIndex: 0,
        status: 'active',
        startedAt: Date.now(),
        endsAt: Date.now() + config.durationMin * 60000,
        submittedAt: null,
        autoSubmitted: false,
        score: null
      }
      this.sessions.push(session)
      return session.id
    },

    setExamAnswer(sessionId, qid, userAnswer) {
      const s = this.sessionById(sessionId)
      if (!s) return
      if (!s.answers[qid]) s.answers[qid] = { userAnswer: null, marked: false, selfMark: null }
      s.answers[qid].userAnswer = userAnswer
    },

    toggleMark(sessionId, qid) {
      const s = this.sessionById(sessionId)
      if (!s) return
      if (!s.answers[qid]) s.answers[qid] = { userAnswer: null, marked: false, selfMark: null }
      s.answers[qid].marked = !s.answers[qid].marked
    },

    _questionPoints(q, rule) {
      if (rule.mode === 'uniform') return rule.value
      return rule.points[q.type] ?? 1
    },

    submitExam(sessionId, { auto = false } = {}) {
      const bankStore = useBankStore()
      const s = this.sessionById(sessionId)
      if (!s || s.status !== 'active') return
      s.autoSubmitted = auto
      s.submittedAt = Date.now()
      s.status = 'done'

      let objScore = 0
      let objFull = 0
      let subjFull = 0
      for (const qid of s.questionIds) {
        const q = bankStore.questionById(qid)
        if (!q) continue
        const rec = s.answers[qid] || { userAnswer: null, marked: false, selfMark: null }
        const pts = this._questionPoints(q, s.config.scoreRule)
        if (isObjective(q.type)) {
          const correct = gradeAnswer(q, rec.userAnswer)
          objFull += pts
          if (correct) objScore += pts
          else this._collectWrong(q, sessionId, rec.userAnswer)
          this._pushLog({
            questionId: qid, type: q.type, mode: 'exam', sessionId,
            userAnswer: rec.userAnswer, correct
          })
        } else {
          subjFull += pts
          this._pushLog({
            questionId: qid, type: q.type, mode: 'exam', sessionId,
            userAnswer: rec.userAnswer, correct: null // 待自评
          })
        }
      }
      s.score = {
        objective: objScore,
        objectiveFull: objFull,
        subjective: 0,
        subjectiveFull: subjFull,
        total: objScore,
        full: objFull + subjFull,
        passLine: s.config.passLine
      }
    },

    // 考后主观题自评：答对记满分，答错记 0 分
    selfEvalExam(sessionId, qid, correct) {
      const bankStore = useBankStore()
      const s = this.sessionById(sessionId)
      if (!s || !s.score) return
      const q = bankStore.questionById(qid)
      if (!q) return
      const rec = s.answers[qid]
      if (!rec) return
      rec.selfMark = correct
      const pts = this._questionPoints(q, s.config.scoreRule)
      const prev = rec.appliedPoints || 0
      rec.appliedPoints = correct ? pts : 0
      s.score.subjective += rec.appliedPoints - prev
      s.score.total = s.score.objective + s.score.subjective
      // 同步答题记录（更新最近一条该题日志）
      for (let i = this.logs.length - 1; i >= 0; i--) {
        if (this.logs[i].sessionId === sessionId && this.logs[i].questionId === qid) {
          this.logs[i].correct = correct
          this.logs[i].selfEval = true
          break
        }
      }
      if (correct === false) this._collectWrong(q, sessionId, rec.userAnswer)
    },

    // 恢复过期未交卷的考试（应用启动时调用）
    recoverExpired() {
      const now = Date.now()
      for (const s of this.sessions) {
        if (s.mode === 'exam' && s.status === 'active' && s.endsAt <= now) {
          this.submitExam(s.id, { auto: true })
        }
      }
    },

    // ===== 错题本（已独立到 wrongbook store，此处不再管理）=====

    // 删除场次：同步清掉该场次的答题记录（错题本独立存储，不受影响）
    deleteSession(sessionId) {
      this.sessions = this.sessions.filter((x) => x.id !== sessionId)
      this.logs = this.logs.filter((l) => l.sessionId !== sessionId)
    }
  }
})
