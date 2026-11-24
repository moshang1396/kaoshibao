<script setup>
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { readWorkbook, gridToRows, validateRows, parseJsonImport, downloadTemplate, TEMPLATE_HEADERS } from '../utils/importer'
import { genId } from '../utils/types'
import { useBankStore } from '../stores/banks'
import TypeBadge from '../components/TypeBadge.vue'

const router = useRouter()
const bankStore = useBankStore()

const fileName = ref('')
const rows = ref([])
const invalid = ref([])
const valid = ref([])
const error = ref('')
const sourceLabel = ref('')

const target = reactive({
  mode: 'new',           // new | append
  newBankName: '',
  appendBankId: ''
})

const nameConflict = computed(() =>
  target.mode === 'new' &&
  target.newBankName &&
  bankStore.banks.some((b) => b.name === target.newBankName.trim())
)

function resetResult() {
  rows.value = []
  valid.value = []
  invalid.value = []
  error.value = ''
  target.mode = 'new'
  target.appendBankId = ''
}

async function onFileChange(e) {
  const file = e.target.files?.[0]
  if (!file) return
  resetResult()
  fileName.value = file.name
  target.newBankName = file.name.replace(/\.(xlsx|xls|csv)$/i, '')
  try {
    const grid = await readWorkbook(file)
    const { rows: parsed, headerError } = gridToRows(grid)
    if (headerError) {
      error.value = headerError
      return
    }
    applyRows(parsed, 'Excel 文件')
  } catch (err) {
    error.value = '解析失败：' + (err.message || err)
  } finally {
    e.target.value = ''
  }
}

function parseJson() {
  resetResult()
  const text = jsonText.value.trim()
  if (!text) return
  const res = parseJsonImport(text)
  if (res.error) {
    error.value = res.error
    return
  }
  applyRows(res.rows, 'JSON 粘贴')
}

function applyRows(parsed, label) {
  rows.value = parsed
  sourceLabel.value = label
  const { valid: v, invalid: inv } = validateRows(parsed)
  valid.value = v
  invalid.value = inv
  if (bankStore.banks.length && !target.appendBankId) {
    target.appendBankId = bankStore.banks[0].id
  }
}

const importCount = computed(() => valid.value.length)

function doImport() {
  if (!importCount.value) return
  const questions = valid.value.map((r) => r.question)
  let bankId
  if (target.mode === 'append' && target.appendBankId) {
    bankStore.appendToBank(target.appendBankId, questions)
    bankId = target.appendBankId
  } else if (nameConflict.value) {
    // 同名题库 → 覆盖
    const exist = bankStore.banks.find((b) => b.name === target.newBankName.trim())
    bankStore.replaceBank(exist.id, questions.map((q) => ({ ...q, id: genId('q') })))
    bankId = exist.id
  } else {
    bankId = bankStore.createBank(target.newBankName.trim() || '未命名题库', questions)
  }
  router.push(`/practice/config/${bankId}`)
}

function rowPreview(r) {
  const s = (r.raw?.stem || r.stem || '')
  return s.length > 26 ? s.slice(0, 26) + '…' : s
}

const jsonText = ref('')

const jsonExample = `[
  {
    "题型": "单选",
    "题干": "HTTP 默认端口是？",
    "选项A": "21", "选项B": "80", "选项C": "443", "选项D": "8080",
    "答案": "B",
    "解析": "HTTP 默认 80。",
    "标签": "网络"
  }
]`
</script>

<template>
  <div class="card">
    <h3>📥 导入题目</h3>
    <p class="muted small">
      第一步：下载 Excel 模板，按格式填写题目；也可以直接粘贴 JSON。
      导入前会逐行校验，无效的行不会进入题库。
    </p>
    <div class="row">
      <button class="btn primary" @click="downloadTemplate">⬇ 下载 Excel 模板</button>
    </div>
  </div>

  <div class="card">
    <h3>模板格式说明</h3>
    <div class="muted small mb" style="line-height: 2">
      <b>列：</b>{{ TEMPLATE_HEADERS.join(' · ') }}<br />
      <b>题型</b>填：单选题 / 多选题 / 判断题 / 填空题 / 简答题 / 应用题 / 画图题<br />
      <b>答案</b>填法：单选填字母（如 <code>B</code>）；多选填多个字母（如 <code>ABD</code>）；判断填
      <code>对</code> 或 <code>错</code>；填空填标准答案（多个可接受答案用 <code>|</code> 或 <code>；</code> 分隔）；
      简答 / 应用 / 画图填<b>参考答案</b>；<b>标签</b>用逗号分隔，选填。
    </div>
  </div>

  <div class="card">
    <h3>① Excel 导入</h3>
    <label class="file-label">
      <input type="file" accept=".xlsx,.xls,.csv" @change="onFileChange" hidden />
      <span class="btn">{{ fileName ? '📁 ' + fileName : '📁 选择 Excel / CSV 文件' }}</span>
    </label>
    <div v-if="fileName" class="muted small mt">来源：{{ sourceLabel }}</div>
  </div>

  <div class="card">
    <h3>② JSON 导入（选填）</h3>
    <textarea v-model="jsonText" rows="6" :placeholder="'粘贴题目 JSON 数组，例如：\n' + jsonExample"></textarea>
    <div class="row mt">
      <button class="btn" @click="parseJson">解析 JSON</button>
    </div>
  </div>

  <div v-if="error" class="alert err">❌ {{ error }}</div>

  <!-- 校验报告 -->
  <div v-if="rows.length" class="card">
    <h3>校验报告</h3>
    <div class="row mb">
      <span class="alert ok" style="margin: 0">✅ 可导入 {{ importCount }} 条</span>
      <span v-if="invalid.length" class="alert err" style="margin: 0">❌ 无效 {{ invalid.length }} 条</span>
    </div>

    <div v-if="invalid.length" class="invalid-list mb">
      <div v-for="r in invalid" :key="r.rowNo" class="invalid-row">
        <span class="muted small" style="flex: none; width: 52px">第{{ r.rowNo}}行</span>
        <div>
          <div class="small">{{ rowPreview(r) || '（空行/无效）' }}</div>
          <div v-for="(e, i) in r.errors" :key="i" class="muted small" style="color: var(--red)">· {{ e }}</div>
        </div>
      </div>
    </div>

    <div v-if="importCount" class="form-item">
      <label>导入到哪里？</label>
      <div class="radio-row">
        <span class="radio-chip" :class="{ on: target.mode === 'new' }" @click="target.mode = 'new'">新建题库</span>
        <span
          v-if="bankStore.banks.length"
          class="radio-chip"
          :class="{ on: target.mode === 'append' }"
          @click="target.mode = 'append'"
        >追加到现有题库</span>
      </div>
      <div class="mt">
        <template v-if="target.mode === 'new'">
          <input v-model="target.newBankName" type="text" placeholder="新题库名称" style="width: 280px" />
          <div v-if="nameConflict" class="alert warn mt" style="margin-bottom: 0">
            ⚠️ 已存在同名题库，本次导入将<b>替换</b>该题库的全部题目
          </div>
        </template>
        <template v-else>
          <select v-model="target.appendBankId">
            <option v-for="b in bankStore.banks" :key="b.id" :value="b.id">{{ b.name }}（{{ bankStore.countOf(b.id) }} 题）</option>
          </select>
        </template>
      </div>
    </div>

    <button class="btn primary lg" :disabled="!importCount" @click="doImport">
      确认导入 {{ importCount }} 条题目
    </button>
  </div>
</template>

<style scoped>
.file-label { cursor: pointer; }
.invalid-list { max-height: 260px; overflow: auto; border: 1px solid var(--border); border-radius: 10px; padding: 6px 12px; }
.invalid-row { display: flex; gap: 8px; padding: 8px 0; border-bottom: 1px dashed var(--border); }
.invalid-row:last-child { border-bottom: none; }
code { background: #f0f2f7; border-radius: 4px; padding: 0 5px; }
</style>
