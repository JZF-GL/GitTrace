<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { NButton, NSpace, NEmpty, NInput, NModal, NSpin, useMessage } from 'naive-ui'
import { useRepositoryStore } from '../../stores/repository'
import { useStagingStore } from '../../stores/staging'

const repoStore = useRepositoryStore()
const stagingStore = useStagingStore()
const message = useMessage()
const repo = computed(() => repoStore.currentRepo)

interface StashItem { hash: string; date: string; message: string }
interface StashFile { status: string; path: string }
interface DiffLine { type: 'header' | 'hunk' | 'add' | 'remove' | 'normal'; text: string; oldLineNum: number | null; newLineNum: number | null }

const stashList = ref<StashItem[]>([])
const loading = ref(false)
const showStashCreate = ref(false)
const stashMessage = ref('')
const selectedIndex = ref<number | null>(null)
const selectedStash = computed(() => selectedIndex.value !== null ? stashList.value[selectedIndex.value] : null)
const files = ref<StashFile[]>([])
const selectedFile = ref<string | null>(null)
const diff = ref('')
const loadingFiles = ref(false)
const loadingDiff = ref(false)

async function fetchStashList() {
  if (!repo.value) return
  loading.value = true
  try {
    const result = await window.electronAPI.git.stashList(repo.value.path)
    stashList.value = result.all || []
    if (stashList.value.length > 0 && selectedIndex.value === null) {
      selectedIndex.value = 0
      await fetchStashFiles(0)
    } else if (stashList.value.length === 0) {
      selectedIndex.value = null
    }
  } finally {
    loading.value = false
  }
}

async function selectStash(index: number) {
  selectedIndex.value = index
  selectedFile.value = null
  diff.value = ''
  files.value = []
  await fetchStashFiles(index)
}

async function fetchStashFiles(index: number) {
  if (!repo.value) return
  loadingFiles.value = true
  try {
    const result = await window.electronAPI.git.stashShowFiles(repo.value.path, `stash@{${index}}`)
    files.value = result.files || []
    if (files.value.length > 0) {
      selectedFile.value = files.value[0].path
    }
  } finally {
    loadingFiles.value = false
  }
}

watch(selectedFile, async (file) => {
  if (!file || selectedIndex.value === null || !repo.value) { diff.value = ''; return }
  loadingDiff.value = true
  try {
    diff.value = await window.electronAPI.git.stashShowDiff(repo.value.path, `stash@{${selectedIndex.value}}`, file)
  } finally {
    loadingDiff.value = false
  }
})

function getStatusSymbol(s: string) { return s.startsWith('A') ? 'A' : s.startsWith('D') ? 'D' : s.startsWith('R') ? 'R' : 'M' }
function getStatusClass(s: string) { return s.startsWith('A') ? 'status-added' : s.startsWith('D') ? 'status-deleted' : s.startsWith('R') ? 'status-renamed' : 'status-modified' }

function parseDiffLines(text: string): DiffLine[] {
  const result: DiffLine[] = []
  let oldLine = 0, newLine = 0
  for (const raw of text.split('\n')) {
    if (raw.startsWith('diff --git') || raw.startsWith('index ') || raw.startsWith('---') || raw.startsWith('+++')) {
      result.push({ type: 'header', text: raw, oldLineNum: null, newLineNum: null })
    } else if (raw.startsWith('@@')) {
      const m = raw.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
      if (m) { oldLine = parseInt(m[1]); newLine = parseInt(m[2]) }
      result.push({ type: 'hunk', text: raw, oldLineNum: null, newLineNum: null })
    } else if (raw.startsWith('+') && !raw.startsWith('+++')) {
      result.push({ type: 'add', text: raw, oldLineNum: null, newLineNum: newLine }); newLine++
    } else if (raw.startsWith('-') && !raw.startsWith('---')) {
      result.push({ type: 'remove', text: raw, oldLineNum: oldLine, newLineNum: null }); oldLine++
    } else {
      result.push({ type: 'normal', text: raw, oldLineNum: oldLine, newLineNum: newLine }); oldLine++; newLine++
    }
  }
  return result
}

const parsedDiff = computed(() => parseDiffLines(diff.value))

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr), now = new Date(), diffMs = now.getTime() - d.getTime()
  const minutes = Math.floor(diffMs / 60000), hours = Math.floor(diffMs / 3600000), days = Math.floor(diffMs / 86400000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  if (hours < 24) return `${hours} 小时前`
  if (days < 7) return `${days} 天前`
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

async function handleStashPush() {
  if (!repo.value) return
  const result = await window.electronAPI.git.stashPush(repo.value.path, stashMessage.value || undefined)
  if (result?.success) { message.success(result.message); stashMessage.value = ''; showStashCreate.value = false; await fetchStashList(); await stagingStore.fetchStatus(repo.value.path) }
  else { message.error('暂存失败: ' + (result?.message || '未知错误')) }
}

async function handleStashPop(index?: number) {
  if (!repo.value) return
  const stashRef = index !== undefined ? `stash@{${index}}` : undefined
  const result = await window.electronAPI.git.stashPop(repo.value.path, stashRef)
  if (result?.success) { message.success(result.message); await fetchStashList(); await stagingStore.fetchStatus(repo.value.path) }
  else { message.error('弹出失败: ' + (result?.message || '未知错误')) }
}

async function handleStashDrop(index: number) {
  if (!repo.value) return
  const result = await window.electronAPI.git.stashDrop(repo.value.path, `stash@{${index}}`)
  if (result?.success) {
    message.success(result.message)
    if (selectedIndex.value === index) { selectedIndex.value = null; files.value = []; selectedFile.value = null; diff.value = '' }
    else if (selectedIndex.value !== null && selectedIndex.value > index) { selectedIndex.value-- }
    await fetchStashList()
  } else { message.error('删除失败: ' + (result?.message || '未知错误')) }
}

onMounted(fetchStashList)
</script>

<template>
  <div class="stash-panel">
    <div class="stash-actions">
      <NSpace>
        <NButton type="primary" @click="showStashCreate = true" :disabled="stagingStore.stagedFiles.length === 0 && stagingStore.unstagedFiles.length === 0">暂存更改</NButton>
        <NButton @click="handleStashPop()" :disabled="stashList.length === 0">弹出最近</NButton>
      </NSpace>
    </div>

    <div class="stash-content">
      <div class="stash-sidebar">
        <div class="sidebar-section">
          <div class="section-header">Stash ({{ stashList.length }})</div>
          <div class="stash-list" v-if="!loading">
            <NEmpty v-if="stashList.length === 0" description="暂无 Stash" :style="{ padding: '20px 0' }" />
            <div v-for="(stash, index) in stashList" :key="stash.hash" class="stash-item" :class="{ selected: selectedIndex === index }" @click="selectStash(index)">
              <div class="stash-info">
                <span class="stash-index">stash@{{ '{' + index + '}' }}</span>
                <span class="stash-date">{{ formatDate(stash.date) }}</span>
              </div>
              <div class="stash-message">{{ stash.message || '(无消息)' }}</div>
              <div class="stash-actions-row">
                <NButton size="tiny" quaternary @click.stop="handleStashPop(index)">应用</NButton>
                <NButton size="tiny" quaternary type="error" @click.stop="handleStashDrop(index)">删除</NButton>
              </div>
            </div>
          </div>
          <div v-else class="loading"><NSpin size="small" /></div>
        </div>

        <div class="sidebar-section file-section" v-if="selectedStash">
          <div class="section-header">修改的文件 ({{ files.length }})</div>
          <div class="file-list" v-if="!loadingFiles">
            <NEmpty v-if="files.length === 0" description="无文件变更" :style="{ padding: '20px 0' }" />
            <div v-for="file in files" :key="file.path" class="file-item" :class="{ selected: selectedFile === file.path }" @click="selectedFile = file.path">
              <span class="file-status" :class="getStatusClass(file.status)">{{ getStatusSymbol(file.status) }}</span>
              <span class="file-path">{{ file.path }}</span>
            </div>
          </div>
          <div v-else class="loading"><NSpin size="small" /></div>
        </div>
      </div>

      <div class="diff-panel">
        <div v-if="selectedStash && selectedFile && !loadingDiff && diff" class="diff-content">
          <div class="diff-file-header"><span class="diff-file-path">{{ selectedFile }}</span></div>
          <table class="diff-table"><tbody>
            <tr v-for="(line, i) in parsedDiff" :key="i" :class="'diff-row diff-row-' + line.type">
              <td class="line-num old">{{ line.oldLineNum ?? '' }}</td>
              <td class="line-num new">{{ line.newLineNum ?? '' }}</td>
              <td class="line-prefix">{{ line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' ' }}</td>
              <td class="line-code">{{ line.text.replace(/^[+\- ]/, '') }}</td>
            </tr>
          </tbody></table>
        </div>
        <div v-else-if="loadingDiff" class="diff-loading"><NSpin size="medium" /></div>
        <div v-else class="diff-empty"><NEmpty description="选择文件查看变更" /></div>
      </div>
    </div>

    <NModal v-model:show="showStashCreate">
      <div class="modal-content">
        <h3>创建 Stash</h3>
        <NInput v-model:value="stashMessage" placeholder="备注信息 (可选)" style="margin-top: 12px" />
        <NSpace style="margin-top: 16px">
          <NButton type="primary" @click="handleStashPush">暂存</NButton>
          <NButton @click="showStashCreate = false">取消</NButton>
        </NSpace>
      </div>
    </NModal>
  </div>
</template>

<style scoped>
.stash-panel { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.stash-actions { flex-shrink: 0; padding: 12px 16px; border-bottom: 1px solid var(--border-color); }
.stash-content { flex: 1; display: flex; overflow: hidden; min-height: 0; }
.stash-sidebar { width: 350px; min-width: 280px; max-width: 500px; border-right: 1px solid var(--border-color); display: flex; flex-direction: column; overflow: hidden; }
.sidebar-section { display: flex; flex-direction: column; overflow: hidden; flex: 1; min-height: 0; }
.file-section { border-top: 1px solid var(--border-color); flex: 1; min-height: 0; }
.section-header { padding: 8px 12px; font-size: 11px; font-weight: 600; color: var(--text-secondary); background: var(--bg-tertiary); flex-shrink: 0; }
.stash-list { overflow-y: auto; flex: 1; }
.stash-item { padding: 10px 14px; border-bottom: 1px solid var(--border-color); cursor: pointer; transition: background 0.1s; }
.stash-item:hover { background: var(--bg-hover); }
.stash-item.selected { background: rgba(88, 166, 255, 0.1); }
.stash-info { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.stash-index { font-family: monospace; font-size: 11px; font-weight: 600; color: var(--accent-orange); background: rgba(210, 153, 34, 0.12); padding: 1px 6px; border-radius: 3px; }
.stash-date { font-size: 11px; color: var(--text-muted); }
.stash-message { font-size: 12px; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 4px; }
.stash-actions-row { display: flex; gap: 2px; }
.file-list { overflow-y: auto; flex: 1; min-height: 0; }
.file-item { display: flex; align-items: center; gap: 8px; padding: 5px 12px; cursor: pointer; font-size: 12px; border-bottom: 1px solid var(--border-color); transition: background 0.1s; }
.file-item:hover { background: var(--bg-hover); }
.file-item.selected { background: rgba(88, 166, 255, 0.1); }
.file-status { width: 14px; font-size: 11px; font-weight: 700; font-family: monospace; }
.status-added { color: var(--accent-green); }
.status-deleted { color: var(--accent-red); }
.status-renamed { color: var(--accent-orange); }
.status-modified { color: var(--accent-blue); }
.file-path { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: 'Cascadia Code', monospace; }
.diff-panel { flex: 1; overflow: auto; min-width: 0; }
.diff-content { font-family: 'Cascadia Code', 'Fira Code', 'SF Mono', monospace; font-size: 12px; line-height: 1.5; }
.diff-file-header { position: sticky; top: 0; z-index: 1; padding: 8px 16px; background: var(--bg-secondary); border-bottom: 1px solid var(--border-color); }
.diff-file-path { font-size: 12px; font-weight: 600; color: var(--text-secondary); }
.diff-table { width: 100%; border-collapse: collapse; }
.diff-row { white-space: pre; }
.diff-row-header { background: var(--bg-tertiary); }
.diff-row-header .line-code { color: var(--text-muted); }
.diff-row-hunk { background: rgba(188, 140, 255, 0.08); }
.diff-row-hunk .line-code { color: var(--accent-purple); }
.diff-row-add { background: rgba(63, 185, 80, 0.12); }
.diff-row-add .line-code { color: #7ee787; }
.diff-row-remove { background: rgba(248, 81, 73, 0.12); }
.diff-row-remove .line-code { color: #ffa198; }
.diff-row-normal .line-code { color: var(--text-primary); }
.line-num { width: 50px; padding: 0 8px; text-align: right; color: var(--text-muted); user-select: none; border-right: 1px solid var(--border-color); vertical-align: top; }
.line-num.old { background: rgba(248, 81, 73, 0.05); }
.line-num.new { background: rgba(63, 185, 80, 0.05); }
.line-prefix { width: 20px; padding: 0 4px; text-align: center; color: var(--text-muted); user-select: none; vertical-align: top; }
.diff-row-add .line-prefix { color: var(--accent-green); }
.diff-row-remove .line-prefix { color: var(--accent-red); }
.line-code { padding: 0 16px; vertical-align: top; word-break: break-all; }
.diff-loading { flex: 1; display: flex; align-items: center; justify-content: center; height: 100%; }
.diff-empty { flex: 1; display: flex; align-items: center; justify-content: center; height: 100%; }
.loading { display: flex; align-items: center; justify-content: center; padding: 20px; }
.modal-content { background: var(--bg-secondary); padding: 24px; border-radius: 8px; min-width: 400px; }
.modal-content h3 { margin: 0; color: var(--text-primary); }
</style>
