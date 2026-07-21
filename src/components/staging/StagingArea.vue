<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { NButton, NInput, NSpace, NEmpty, NSelect, useMessage } from 'naive-ui'
import { useRepositoryStore } from '../../stores/repository'
import { useStagingStore, type FileChange } from '../../stores/staging'
import { useCommitsStore } from '../../stores/commits'
import DiffViewer from './DiffViewer.vue'

const repoStore = useRepositoryStore()
const stagingStore = useStagingStore()
const commitsStore = useCommitsStore()
const message = useMessage()

const selectedFile = ref<string | null>(null)
const selectedFileStaged = ref(false)
const repo = computed(() => repoStore.currentRepo)
const pushing = ref(false)
const pulling = ref(false)
const commitType = ref<string | null>(null)

// Commit message history
const commitHistory = ref<string[]>([])
const historyIndex = ref(-1)
const savedDraft = ref('')

async function loadCommitHistory() {
  if (!repo.value) return
  try {
    const log = await window.electronAPI.git.log(repo.value.path, { maxCount: 50 })
    if (log?.all) {
      commitHistory.value = log.all.map((c: any) => c.message)
    }
  } catch (e) {
    console.error('Failed to load commit history:', e)
  }
}

watch(() => repo.value, () => {
  loadCommitHistory()
}, { immediate: true })

function handleCommitKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (commitHistory.value.length === 0) return
    if (historyIndex.value === -1) {
      savedDraft.value = stagingStore.commitMessage
      historyIndex.value = 0
    } else if (historyIndex.value < commitHistory.value.length - 1) {
      historyIndex.value++
    }
    stagingStore.commitMessage = commitHistory.value[historyIndex.value]
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (historyIndex.value === -1) return
    if (historyIndex.value > 0) {
      historyIndex.value--
      stagingStore.commitMessage = commitHistory.value[historyIndex.value]
    } else {
      historyIndex.value = -1
      stagingStore.commitMessage = savedDraft.value
    }
  }
}

function handleCommitInput() {
  historyIndex.value = -1
}

const commitTypeOptions = [
  { label: 'feat', value: 'feat' },
  { label: 'fix', value: 'fix' },
  { label: 'docs', value: 'docs' },
  { label: 'style', value: 'style' },
  { label: 'refactor', value: 'refactor' },
  { label: 'perf', value: 'perf' },
  { label: 'test', value: 'test' },
  { label: 'build', value: 'build' },
  { label: 'ci', value: 'ci' },
  { label: 'chore', value: 'chore' },
  { label: 'revert', value: 'revert' },
]

const stagedFiles = computed(() => stagingStore.stagedFiles)
const unstagedFiles = computed(() => [...stagingStore.unstagedFiles, ...stagingStore.untrackedFiles])

async function handleStageFile(path: string) {
  if (!repo.value) return
  await stagingStore.stageFiles(repo.value.path, [path])
}

async function handleUnstageFile(path: string) {
  if (!repo.value) return
  await stagingStore.unstageFiles(repo.value.path, [path])
}

async function handleStageAll() {
  if (!repo.value) return
  await stagingStore.stageAll(repo.value.path)
}

async function handleUnstageAll() {
  if (!repo.value) return
  const paths = stagedFiles.value.map(f => f.path)
  if (paths.length > 0) {
    await stagingStore.unstageFiles(repo.value.path, paths)
  }
}

async function handleDiscard(file: FileChange) {
  if (!repo.value) return
  // Reset the file to last commit
  await window.electronAPI.git.reset(repo.value.path, [file.path])
  await stagingStore.fetchStatus(repo.value.path)
}

async function handleCommit() {
  if (!repo.value || !stagingStore.commitMessage) return
  try {
    const msg = commitType.value ? `${commitType.value}: ${stagingStore.commitMessage}` : stagingStore.commitMessage
    await window.electronAPI.git.commit(repo.value.path, msg)
    stagingStore.commitMessage = ''
    commitType.value = null
    await stagingStore.fetchStatus(repo.value.path)
    message.success('提交成功')
  } catch (e: any) {
    message.error('提交失败: ' + (e.message || String(e)))
  }
}

async function handlePush() {
  if (!repo.value || pushing.value) return
  pushing.value = true
  try {
    const result = await window.electronAPI.git.push(repo.value.path)
    if (result.success) {
      message.success('推送成功')
      await stagingStore.fetchStatus(repo.value.path)
    } else {
      message.error('推送失败: ' + result.message)
    }
  } finally {
    pushing.value = false
  }
}

async function handlePull() {
  if (!repo.value || pulling.value) return
  pulling.value = true
  try {
    const result = await window.electronAPI.git.pull(repo.value.path)
    if (result.success) {
      message.success('拉取成功')
      await Promise.all([
        stagingStore.fetchStatus(repo.value.path),
        commitsStore.fetchGraph(repo.value.path),
      ])
    } else {
      message.error('拉取失败: ' + result.message)
    }
  } finally {
    pulling.value = false
  }
}

function handleSelectFile(path: string, staged: boolean) {
  selectedFile.value = path
  selectedFileStaged.value = staged
}

function getStatusSymbol(file: FileChange): string {
  if (file.index === '?' && file.workingDir === '?') return '?'
  if (file.index === 'A') return 'A'
  if (file.index === 'D' || file.workingDir === 'D') return 'D'
  if (file.index === 'R') return 'R'
  if (file.index === 'M' || file.workingDir === 'M') return 'M'
  return 'M'
}

function getStatusClass(file: FileChange): string {
  if (file.index === '?' && file.workingDir === '?') return 'status-untracked'
  if (file.index === 'A') return 'status-added'
  if (file.index === 'D' || file.workingDir === 'D') return 'status-deleted'
  if (file.index === 'R') return 'status-renamed'
  return 'status-modified'
}
</script>

<template>
  <div class="staging-area">
    <div class="staging-sidebar">
      <!-- Commit message -->
      <div class="commit-area">
        <NInput
          v-model:value="stagingStore.commitMessage"
          type="textarea"
          placeholder="提交信息... (上下键选择历史)"
          :rows="2"
          :autosize="{ minRows: 2, maxRows: 4 }"
          @keydown="handleCommitKeydown"
          @input="handleCommitInput"
        />
        <div class="commit-actions">
          <NSelect
            v-model:value="commitType"
            :options="commitTypeOptions"
            placeholder="类型"
            size="small"
            style="width: 100px"
            clearable
          />
          <NButton
            type="primary"
            size="small"
            :disabled="!stagingStore.commitMessage || stagedFiles.length === 0"
            @click="handleCommit"
          >
            提交
          </NButton>
          <NButton size="small" :loading="pulling" :disabled="pushing" @click="handlePull">拉取</NButton>
          <NButton size="small" :loading="pushing" :disabled="pulling" @click="handlePush">
            推送 {{ stagingStore.ahead > 0 ? '(' + stagingStore.ahead + ')' : '' }}
          </NButton>
        </div>
      </div>

      <!-- Staged changes -->
      <div class="file-section" v-if="stagedFiles.length > 0">
        <div class="section-header">
          <span class="section-title">已暂存的更改 ({{ stagedFiles.length }})</span>
          <button class="section-action" @click="handleUnstageAll">全部撤销</button>
        </div>
        <div class="file-list">
          <div
            v-for="file in stagedFiles"
            :key="'staged-' + file.path"
            class="file-item"
            :class="{ selected: selectedFile === file.path && selectedFileStaged === true }"
            @click="handleSelectFile(file.path, true)"
          >
            <span class="file-status" :class="getStatusClass(file)">{{ getStatusSymbol(file) }}</span>
            <span class="file-path">{{ file.path }}</span>
            <button class="file-action unstage" @click.stop="handleUnstageFile(file.path)" title="撤销暂存">
              &#8722;
            </button>
          </div>
        </div>
      </div>

      <!-- Changes -->
      <div class="file-section" v-if="unstagedFiles.length > 0">
        <div class="section-header">
          <span class="section-title">更改 ({{ unstagedFiles.length }})</span>
          <button class="section-action" @click="handleStageAll">全部暂存</button>
        </div>
        <div class="file-list">
          <div
            v-for="file in unstagedFiles"
            :key="'unstaged-' + file.path"
            class="file-item"
            :class="{ selected: selectedFile === file.path && selectedFileStaged === false }"
            @click="handleSelectFile(file.path, false)"
          >
            <span class="file-status" :class="getStatusClass(file)">{{ getStatusSymbol(file) }}</span>
            <span class="file-path">{{ file.path }}</span>
            <button class="file-action stage" @click.stop="handleStageFile(file.path)" title="暂存更改">
              +
            </button>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-if="stagedFiles.length === 0 && unstagedFiles.length === 0" class="empty-state">
        <NEmpty description="没有更改" />
      </div>
    </div>

    <!-- Diff viewer -->
    <div class="diff-container">
      <DiffViewer
        v-if="selectedFile && repo"
        :repo-path="repo.path"
        :file-path="selectedFile"
        :staged="selectedFileStaged"
      />
      <div v-else class="no-diff">
        <span>&#128196;</span>
        <p>选择文件查看变更</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.staging-area {
  display: flex;
  height: 100%;
  overflow: hidden;
}

.staging-sidebar {
  width: 45%;
  min-width: 300px;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border-color);
  overflow: hidden;
  flex-shrink: 0;
}

.commit-area {
  padding: 12px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
  flex-shrink: 0;
}

.commit-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.file-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-bottom: 1px solid var(--border-color);
  min-height: 0;
}

.file-section:last-child {
  border-bottom: none;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--bg-tertiary);
}

.section-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.section-action {
  border: none;
  background: transparent;
  color: var(--accent-blue);
  cursor: pointer;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
}

.section-action:hover {
  background: rgba(88, 166, 255, 0.1);
}

.file-list {
  flex: 1;
  overflow-y: auto;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  cursor: pointer;
  transition: background 0.1s;
}

.file-item:hover {
  background: var(--bg-hover);
}

.file-item.selected {
  background: rgba(88, 166, 255, 0.1);
}

.file-status {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  font-family: monospace;
  border-radius: 2px;
  flex-shrink: 0;
}

.file-path {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: 'Cascadia Code', 'Fira Code', 'SF Mono', monospace;
  font-size: 12px;
}

.file-action {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 4px;
  font-size: 14px;
  font-weight: bold;
  opacity: 0;
  transition: opacity 0.1s, background 0.1s;
  flex-shrink: 0;
}

.file-item:hover .file-action {
  opacity: 1;
}

.file-action.stage {
  color: var(--accent-green);
}

.file-action.stage:hover {
  background: rgba(63, 185, 80, 0.15);
}

.file-action.unstage {
  color: var(--accent-orange);
}

.file-action.unstage:hover {
  background: rgba(210, 153, 34, 0.15);
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.diff-container {
  flex: 1;
  overflow: auto;
  min-width: 0;
  min-height: 0;
}

.no-diff {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-muted);
  gap: 8px;
}

.no-diff span {
  font-size: 48px;
}
</style>
