<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { NButton, NInput, NSpace, NEmpty, NSelect, NModal, useMessage, useDialog } from 'naive-ui'
import { useRepositoryStore } from '../../stores/repository'
import { useStagingStore, type FileChange } from '../../stores/staging'
import { useCommitsStore } from '../../stores/commits'
import { useBranchesStore } from '../../stores/branches'
import DiffViewer from './DiffViewer.vue'
import ConflictResolver from '../conflict/ConflictResolver.vue'

const repoStore = useRepositoryStore()
const stagingStore = useStagingStore()
const commitsStore = useCommitsStore()
const branchesStore = useBranchesStore()
const message = useMessage()
const dialog = useDialog()

const selectedFile = ref<string | null>(null)
const selectedFileStaged = ref(false)
const repo = computed(() => repoStore.currentRepo)
const pushing = ref(false)
const pulling = ref(false)
const commitType = ref<string | null>(null)

// Stash dialog
const showStashDialog = ref(false)
const stashSelectedFiles = ref<Set<string>>(new Set())
const stashMessage = ref('')

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
const conflictFiles = computed(() => stagingStore.conflictedFiles)
const selectedConflictFile = ref<string | null>(null)
const conflictContent = ref('')
const editedContent = ref('')
const isEditingConflict = ref(false)
const loadingConflict = ref(false)

async function selectConflictFile(path: string) {
  selectedConflictFile.value = path
  selectedFile.value = path
  selectedFileStaged.value = false
  isEditingConflict.value = false
  loadingConflict.value = true
  try {
    const result = await window.electronAPI.git.conflictFile(repo.value!.path, path)
    conflictContent.value = result.working || ''
    editedContent.value = result.working || ''
  } finally {
    loadingConflict.value = false
  }
}

function getConflictParts(content: string) {
  const lines = content.split('\n')
  const result: { type: string; text: string }[] = []
  let inConflict = false
  for (const line of lines) {
    if (line.startsWith('<<<<<<<')) { inConflict = true; result.push({ type: 'ours', text: line }); continue }
    if (line.startsWith('=======')) { result.push({ type: 'separator', text: line }); continue }
    if (line.startsWith('>>>>>>>')) { inConflict = false; result.push({ type: 'theirs', text: line }); continue }
    if (inConflict) {
      result.push({ type: 'ours', text: line })
    } else {
      result.push({ type: 'normal', text: line })
    }
  }
  return result
}

function resolveWithOurs() {
  if (!selectedConflictFile.value || !repo.value) return
  const lines = conflictContent.value.split('\n')
  const result: string[] = []
  let take = false
  for (const line of lines) {
    if (line.startsWith('<<<<<<<')) { take = true; continue }
    if (line.startsWith('=======')) { take = false; continue }
    if (line.startsWith('>>>>>>>')) { continue }
    if (take) result.push(line)
  }
  editedContent.value = result.join('\n')
  saveConflictResolution()
}

function resolveWithTheirs() {
  if (!selectedConflictFile.value || !repo.value) return
  const lines = conflictContent.value.split('\n')
  const result: string[] = []
  let take = false
  for (const line of lines) {
    if (line.startsWith('<<<<<<<')) { take = false; continue }
    if (line.startsWith('=======')) { take = true; continue }
    if (line.startsWith('>>>>>>>')) { take = false; continue }
    if (take) result.push(line)
  }
  editedContent.value = result.join('\n')
  saveConflictResolution()
}

function startManualEdit() {
  isEditingConflict.value = true
}

function cancelManualEdit() {
  isEditingConflict.value = false
  editedContent.value = conflictContent.value
}

async function saveConflictResolution() {
  if (!selectedConflictFile.value || !repo.value) return
  await window.electronAPI.git.resolveConflict(repo.value.path, selectedConflictFile.value, editedContent.value)
  await stagingStore.fetchStatus(repo.value.path)
  message.success('冲突已解决')
  selectedConflictFile.value = null
  conflictContent.value = ''
  editedContent.value = ''
  isEditingConflict.value = false
}

async function handleResolveAll() {
  if (!repo.value || conflictFiles.value.length === 0) return
  const paths = conflictFiles.value.map(f => f.path)
  await window.electronAPI.git.add(repo.value.path, paths)
  await stagingStore.fetchStatus(repo.value.path)
  selectedConflictFile.value = null
  conflictContent.value = ''
  editedContent.value = ''
  message.success('所有冲突已解决')
}

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

function handleDiscardChange(path: string) {
  if (!repo.value) return
  dialog.warning({
    title: '放弃更改',
    content: `确定要放弃对 "${path}" 的更改吗？此操作不可撤销。`,
    positiveText: '确定放弃',
    negativeText: '取消',
    onPositiveClick: async () => {
      await stagingStore.restoreFiles(repo.value!.path, [path])
      message.success('已放弃更改')
    },
  })
}

function handleDiscardAllChanges() {
  if (!repo.value || unstagedFiles.value.length === 0) return
  const count = unstagedFiles.value.length
  dialog.warning({
    title: '放弃所有更改',
    content: `确定要放弃所有 ${count} 个文件的更改吗？此操作不可撤销。`,
    positiveText: '确定放弃',
    negativeText: '取消',
    onPositiveClick: async () => {
      const paths = unstagedFiles.value.map(f => f.path)
      await stagingStore.restoreFiles(repo.value!.path, paths)
      message.success('已放弃所有更改')
    },
  })
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
    await Promise.all([
      stagingStore.fetchStatus(repo.value.path),
      commitsStore.fetchGraphForCurrent(repo.value.path, branchesStore.current),
      branchesStore.fetchBranches(repo.value.path),
    ])
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
      await Promise.all([
        stagingStore.fetchStatus(repo.value.path),
        commitsStore.fetchGraphForCurrent(repo.value.path, branchesStore.current),
        branchesStore.fetchBranches(repo.value.path),
      ])
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
        commitsStore.fetchGraphForCurrent(repo.value.path, branchesStore.current),
        branchesStore.fetchBranches(repo.value.path),
      ])
    } else if (result.conflict) {
      message.warning('拉取有冲突，请解决')
      // 自动填充合并提交信息
      stagingStore.commitMessage = `Merge branch '${branchesStore.current}' of ${repo.value.name} into ${branchesStore.current}`
      await Promise.all([
        stagingStore.fetchStatus(repo.value.path),
        branchesStore.fetchBranches(repo.value.path),
      ])
      showConflictResolver.value = true
    } else {
      message.error('拉取失败: ' + result.message)
    }
  } finally {
    pulling.value = false
  }
}

function handleStash() {
  stashSelectedFiles.value = new Set()
  stashMessage.value = ''
  showStashDialog.value = true
}

function toggleStashFile(path: string) {
  const newSet = new Set(stashSelectedFiles.value)
  if (newSet.has(path)) {
    newSet.delete(path)
  } else {
    newSet.add(path)
  }
  stashSelectedFiles.value = newSet
}

function selectAllStashFiles() {
  const allFiles = unstagedFiles.value.map(f => f.path)
  stashSelectedFiles.value = new Set(allFiles)
}

function deselectAllStashFiles() {
  stashSelectedFiles.value = new Set()
}

async function executeStash() {
  if (!repo.value || stashSelectedFiles.value.size === 0) return
  try {
    const files = Array.from(stashSelectedFiles.value)
    const result = await window.electronAPI.git.stashPush(repo.value.path, stashMessage.value || undefined, files)
    if (result.success) {
      message.success('已暂存更改')
      showStashDialog.value = false
      await stagingStore.fetchStatus(repo.value.path)
    } else {
      message.error('暂存失败: ' + result.message)
    }
  } catch (e: any) {
    message.error('暂存失败: ' + (e.message || String(e)))
  }
}

function handleSelectFile(path: string, staged: boolean) {
  selectedFile.value = path
  selectedFileStaged.value = staged
  selectedConflictFile.value = null
  isEditingConflict.value = false
}

function onConflictResolved() {
  showConflictResolver.value = false
  message.success('所有冲突已解决')
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
          <NButton size="small" @click="handleStash">Stash</NButton>
        </div>
      </div>

      <!-- Merge conflicts -->
      <div class="file-section conflict-section" v-if="conflictFiles.length > 0">
        <div class="section-header conflict-header">
          <span class="section-title">合并冲突 ({{ conflictFiles.length }})</span>
          <button class="section-action conflict-action" @click="handleResolveAll">全部标记已解决</button>
        </div>
        <div class="file-list">
          <div
            v-for="file in conflictFiles"
            :key="'conflict-' + file.path"
            class="file-item conflict-item"
            :class="{ selected: selectedConflictFile === file.path }"
            @click="selectConflictFile(file.path)"
          >
            <span class="file-status status-conflict">!</span>
            <span class="file-path">{{ file.path }}</span>
            <button class="file-action resolve" @click.stop="handleResolveConflict(file.path)" title="标记为已解决">
              &#10003;
            </button>
          </div>
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
          <div class="section-actions">
            <button class="section-action discard-all" @click="handleDiscardAllChanges">放弃所有更改</button>
            <button class="section-action" @click="handleStageAll">全部暂存</button>
          </div>
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
            <div class="file-actions">
              <button class="file-action discard" @click.stop="handleDiscardChange(file.path)" title="放弃更改">
                &#8634;
              </button>
              <button class="file-action stage" @click.stop="handleStageFile(file.path)" title="暂存更改">
                +
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-if="stagedFiles.length === 0 && unstagedFiles.length === 0 && conflictFiles.length === 0" class="empty-state">
        <NEmpty description="没有更改" />
      </div>
    </div>

    <!-- Diff viewer or Conflict resolver -->
    <div class="diff-container">
      <!-- Conflict content view -->
      <div v-if="selectedConflictFile && !loadingConflict" class="conflict-view-container">
        <div class="conflict-file-header">
          <span class="conflict-file-path">{{ selectedConflictFile }}</span>
          <div class="conflict-actions">
            <button class="conflict-btn ours" @click="resolveWithOurs">使用当前</button>
            <button class="conflict-btn theirs" @click="resolveWithTheirs">使用引入</button>
            <button class="conflict-btn manual" @click="startManualEdit">手动编辑</button>
          </div>
        </div>
        <!-- Read-only conflict view -->
        <div v-if="!isEditingConflict" class="conflict-content">
          <div
            v-for="(part, i) in getConflictParts(conflictContent)"
            :key="i"
            :class="'conflict-line conflict-' + part.type"
          >{{ part.text }}</div>
        </div>
        <!-- Editable conflict view -->
        <div v-else class="conflict-edit-area">
          <textarea v-model="editedContent" class="conflict-textarea" spellcheck="false" />
          <div class="conflict-edit-actions">
            <button class="conflict-btn cancel" @click="cancelManualEdit">取消</button>
            <button class="conflict-btn save" @click="saveConflictResolution">保存并标记已解决</button>
          </div>
        </div>
      </div>
      <div v-else-if="selectedConflictFile && loadingConflict" class="no-diff">
        <NSpin size="medium" />
      </div>
      <ConflictResolver
        v-else-if="showConflictResolver && conflictFiles.length > 0"
        :files="conflictFiles"
        @resolved="onConflictResolved"
      />
      <DiffViewer
        v-else-if="selectedFile && repo && !selectedConflictFile"
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

  <!-- Stash Dialog -->
  <NModal v-model:show="showStashDialog" preset="card" title="Stash 更改" style="width: 500px; max-height: 600px;">
    <div class="stash-dialog-content">
      <NInput v-model:value="stashMessage" placeholder="Stash 信息（可选）" style="margin-bottom: 12px;" />
      <div class="stash-actions">
        <NButton size="small" @click="selectAllStashFiles">全选</NButton>
        <NButton size="small" @click="deselectAllStashFiles">取消全选</NButton>
        <span class="stash-count">已选 {{ stashSelectedFiles.size }} / {{ unstagedFiles.length }} 个文件</span>
      </div>
      <div class="stash-file-list">
        <div
          v-for="file in unstagedFiles"
          :key="'stash-' + file.path"
          class="stash-file-item"
          :class="{ selected: stashSelectedFiles.has(file.path) }"
          @click="toggleStashFile(file.path)"
        >
          <input
            type="checkbox"
            :checked="stashSelectedFiles.has(file.path)"
            @click.stop
            @change="toggleStashFile(file.path)"
          />
          <span class="file-status" :class="getStatusClass(file)">{{ getStatusSymbol(file) }}</span>
          <span class="file-path">{{ file.path }}</span>
        </div>
      </div>
    </div>
    <template #footer>
      <NSpace justify="end">
        <NButton @click="showStashDialog = false">取消</NButton>
        <NButton type="primary" :disabled="stashSelectedFiles.size === 0" @click="executeStash">
          Stash
        </NButton>
      </NSpace>
    </template>
  </NModal>
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

.section-action.discard-all {
  color: var(--accent-red);
}

.section-action.discard-all:hover {
  background: rgba(248, 81, 73, 0.15);
}

.section-actions {
  display: flex;
  gap: 4px;
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

.file-action.discard {
  color: var(--accent-red);
}

.file-action.discard:hover {
  background: rgba(248, 81, 73, 0.15);
}

.file-actions {
  display: flex;
  gap: 2px;
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

/* Conflict section styles */
.conflict-section {
  border-bottom-color: rgba(248, 81, 73, 0.3);
}

.conflict-header {
  background: rgba(248, 81, 73, 0.08);
  color: var(--accent-red);
}

.conflict-action {
  color: var(--accent-red) !important;
}

.conflict-action:hover {
  background: rgba(248, 81, 73, 0.15) !important;
}

.conflict-item {
  border-left: 2px solid transparent;
}

.conflict-item:hover {
  border-left-color: var(--accent-red);
}

.conflict-item.selected {
  background: rgba(248, 81, 73, 0.08);
  border-left-color: var(--accent-red);
}

.status-conflict {
  color: var(--accent-red);
  font-weight: 700;
}

.file-action.resolve {
  color: var(--accent-green);
}

.file-action.resolve:hover {
  background: rgba(63, 185, 80, 0.15);
}

/* Conflict view in diff panel */
.conflict-view-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.conflict-file-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: rgba(248, 81, 73, 0.08);
  border-bottom: 1px solid rgba(248, 81, 73, 0.2);
  flex-shrink: 0;
}

.conflict-file-path {
  font-family: 'Cascadia Code', monospace;
  font-size: 12px;
  font-weight: 600;
  color: var(--accent-red);
}

.conflict-actions {
  display: flex;
  gap: 6px;
}

.conflict-btn {
  border: none;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: opacity 0.15s;
}

.conflict-btn:hover { opacity: 0.85; }

.conflict-btn.ours {
  background: var(--accent-green);
  color: white;
}

.conflict-btn.theirs {
  background: var(--accent-red);
  color: white;
}

.conflict-btn.manual {
  background: var(--accent-purple);
  color: white;
}

.conflict-btn.cancel {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
}

.conflict-btn.save {
  background: var(--accent-green);
  color: white;
}

.conflict-content {
  flex: 1;
  overflow: auto;
  font-family: 'Cascadia Code', 'Fira Code', 'SF Mono', monospace;
  font-size: 12px;
  line-height: 1.6;
}

.conflict-line {
  padding: 0 16px;
  white-space: pre-wrap;
  word-break: break-all;
}

.conflict-ours {
  background: rgba(63, 185, 80, 0.08);
  color: var(--accent-green);
}

.conflict-separator {
  background: rgba(188, 140, 255, 0.1);
  color: var(--accent-purple);
  font-weight: 600;
}

.conflict-theirs {
  background: rgba(248, 81, 73, 0.08);
  color: var(--accent-red);
}

.conflict-normal {
  color: var(--text-primary);
}

.conflict-edit-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.conflict-textarea {
  flex: 1;
  width: 100%;
  min-height: 0;
  padding: 12px 16px;
  border: none;
  outline: none;
  resize: none;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: 'Cascadia Code', 'Fira Code', 'SF Mono', monospace;
  font-size: 12px;
  line-height: 1.6;
  tab-size: 2;
}

.conflict-edit-actions {
  display: flex;
  gap: 8px;
  padding: 8px 16px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
  flex-shrink: 0;
}

.stash-dialog-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stash-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stash-count {
  font-size: 12px;
  color: var(--text-secondary);
  margin-left: auto;
}

.stash-file-list {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid var(--border-color);
  border-radius: 4px;
}

.stash-file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.1s;
}

.stash-file-item:hover {
  background: var(--bg-hover);
}

.stash-file-item.selected {
  background: rgba(88, 166, 255, 0.1);
}

.stash-file-item input[type="checkbox"] {
  cursor: pointer;
}
</style>
