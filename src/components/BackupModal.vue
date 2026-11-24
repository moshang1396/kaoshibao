<script setup>
// 数据备份 / 迁移弹窗：导出 JSON 或从 JSON 恢复
import { ref } from 'vue'
import { exportBackup, importBackup } from '../utils/backup'

const emit = defineEmits(['close'])

const msg = ref('')
const msgType = ref('')

function doExport() {
  const n = exportBackup()
  if (n != null) {
    msg.value = `已导出 ${n} 项数据，请在浏览器下载中查看备份文件`
    msgType.value = 'ok'
  }
}

async function onFile(e) {
  const file = e.target.files?.[0]
  if (!file) return
  try {
    const n = await importBackup(file)
    if (confirm(`已恢复 ${n} 项数据。页面将刷新以载入恢复的数据。`)) {
      location.reload()
    }
  } catch (err) {
    msg.value = '导入失败：' + (err.message || err)
    msgType.value = 'err'
  } finally {
    e.target.value = ''
  }
}
</script>

<template>
  <div class="modal-mask" @click.self="emit('close')">
    <div class="modal">
      <h4>💾 数据备份 / 迁移</h4>
      <p class="muted small">
        把本设备的全部数据（题库、答题记录、错题本、统计）导出为一个 JSON 文件；
        在其他设备（如手机）上导入该文件即可完成迁移。
      </p>
      <div class="row" style="gap: 12px">
        <button class="btn primary" @click="doExport">⬆ 导出备份</button>
        <label class="file-label">
          <input type="file" accept=".json" @change="onFile" hidden />
          <span class="btn">⬇ 导入恢复</span>
        </label>
      </div>
      <div v-if="msg" class="alert mt" :class="msgType" style="margin-bottom: 0">{{ msg }}</div>
      <div class="btns">
        <button class="btn" @click="emit('close')">关闭</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.file-label { cursor: pointer; }
</style>
