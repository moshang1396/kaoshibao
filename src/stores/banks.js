import { defineStore } from 'pinia'
import { genId } from '../utils/types'
import { DEMO_BANK_NAME, DEMO_QUESTIONS } from '../data/demoBank'

export const useBankStore = defineStore('banks', {
  state: () => ({
    banks: [],          // [{ id, name, createdAt, source }]
    questions: {}       // { [bankId]: [Question, ...] }
  }),

  getters: {
    bankById: (s) => (id) => s.banks.find((b) => b.id === id) || null,
    questionsOf: (s) => (bankId) => s.questions[bankId] || [],
    countOf() {
      return (bankId) => this.questionsOf(bankId).length
    },
    // 各题型数量统计
    typeCountOf() {
      return (bankId) => {
        const stat = {}
        for (const q of this.questionsOf(bankId)) {
          stat[q.type] = (stat[q.type] || 0) + 1
        }
        return stat
      }
    },
    allQuestions: (s) => Object.values(s.questions).flat(),
    questionById: (s) => (id) => {
      for (const arr of Object.values(s.questions)) {
        const q = arr.find((x) => x.id === id)
        if (q) return q
      }
      return null
    },
    bankNameOfQuestion() {
      return (qid) => {
        for (const b of this.banks) {
          if ((this.questions[b.id] || []).some((q) => q.id === qid)) return b.name
        }
        return ''
      }
    }
  },

  actions: {
    createBank(name, questions, source = 'import') {
      const id = genId('bank')
      this.banks.push({ id, name: name || '未命名题库', createdAt: Date.now(), source })
      this.questions[id] = questions.map((q) => ({ ...q, bankId: id }))
      return id
    },

    appendToBank(bankId, questions) {
      if (!this.questions[bankId]) this.questions[bankId] = []
      this.questions[bankId].push(...questions.map((q) => ({ ...q, bankId })))
    },

    replaceBank(bankId, questions) {
      this.questions[bankId] = questions.map((q) => ({ ...q, bankId }))
    },

    deleteBank(bankId) {
      this.banks = this.banks.filter((b) => b.id !== bankId)
      delete this.questions[bankId]
    },

    loadDemoBank() {
      // 已存在则重新载入（替换）
      const exist = this.banks.find((b) => b.name === DEMO_BANK_NAME)
      if (exist) {
        this.replaceBank(exist.id, DEMO_QUESTIONS.map((q) => ({ ...q, id: genId('q') })))
        return exist.id
      }
      return this.createBank(DEMO_BANK_NAME, DEMO_QUESTIONS.map((q) => ({ ...q, id: genId('q') })), 'demo')
    }
  }
})
