import { defineStore } from 'pinia'

// 独立错题本库：与答题记录（sessions/logs）完全解耦。
// 答错时把题目快照存进来——删除答题记录、删除场次、甚至删除题库都不影响错题本内容。
export const useWrongBookStore = defineStore('wrongbook', {
  state: () => ({
    entries: [],    // 错题条目（含题目快照）
    migrated: false // 旧版（日志推导）数据是否已迁移
  }),

  getters: {
    count: (s) => s.entries.length,
    countOfBank: (s) => (bankId) => s.entries.filter((e) => e.bankId === bankId).length,
    // 按最近答错时间倒序
    entriesOfBank: (s) => (bankId) =>
      s.entries
        .filter((e) => e.bankId === bankId)
        .sort((a, b) => b.wrongAt - a.wrongAt),
    has: (s) => (qid) => s.entries.some((e) => e.qid === qid)
  },

  actions: {
    // 答错收进错题本（已有条目则更新时间与次数，保证每题一条）
    addWrong(question, bankId, bankName, userAnswer) {
      if (!question) return
      const e = this.entries.find((x) => x.qid === question.id)
      if (e) {
        e.wrongAt = Date.now()
        e.timesWrong++
        e.lastUserAnswer = userAnswer === undefined ? null : userAnswer
        // 题库重导入后题目 id 不变的情况极少，但保持归属最新
        if (bankId) { e.bankId = bankId; e.bankName = bankName || e.bankName }
      } else {
        this.entries.push({
          qid: question.id,
          bankId: bankId || '',
          bankName: bankName || '',
          // 题目快照：错题本独立于题库存在
          type: question.type,
          stem: question.stem,
          options: JSON.parse(JSON.stringify(question.options || [])),
          answer: JSON.parse(JSON.stringify(question.answer)),
          explanation: question.explanation || '',
          tags: [...(question.tags || [])],
          wrongAt: Date.now(),
          timesWrong: 1,
          lastUserAnswer: userAnswer === undefined ? null : userAnswer
        })
      }
    },

    // 手动移出（纯手动管理）
    removeWrong(qid) {
      this.entries = this.entries.filter((e) => e.qid !== qid)
    },

    // 清空某题库的错题（仅题库删除时由用户决定是否调用；默认不调用，保证独立性）
    clearBank(bankId) {
      this.entries = this.entries.filter((e) => e.bankId !== bankId)
    },

    // 一次性迁移：把旧版"日志推导"的错题导入独立库（仅迁移题目仍存在于题库中的）
    migrateFrom(sessionsStore, bankStore) {
      if (this.migrated) return
      const seen = new Set()
      for (let i = sessionsStore.logs.length - 1; i >= 0; i--) {
        const l = sessionsStore.logs[i]
        if (l.correct !== false) continue
        if (seen.has(l.questionId)) continue
        seen.add(l.questionId)
        const q = bankStore.questionById(l.questionId)
        if (!q) continue // 题目已不存在（重导入/题库删除），跳过——这些正是旧版数据不一致的来源
        const bank = bankStore.bankById(q.bankId)
        if (this.entries.some((e) => e.qid === q.id)) continue
        this.entries.push({
          qid: q.id,
          bankId: q.bankId,
          bankName: bank?.name || '',
          type: q.type,
          stem: q.stem,
          options: JSON.parse(JSON.stringify(q.options || [])),
          answer: JSON.parse(JSON.stringify(q.answer)),
          explanation: q.explanation || '',
          tags: [...(q.tags || [])],
          wrongAt: l.at,
          timesWrong: 1,
          lastUserAnswer: l.userAnswer
        })
      }
      this.migrated = true
    }
  }
})
