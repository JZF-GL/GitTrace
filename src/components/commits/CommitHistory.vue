<script setup lang="ts">
import { computed, ref, watch, h } from 'vue'
import { NInput, NEmpty, NSpin, NButton, NSpace, NDropdown, NSelect, NModal, useMessage, useDialog } from 'naive-ui'
import { useCommitsStore } from '../../stores/commits'
import { useRepositoryStore } from '../../stores/repository'
import { useBranchesStore } from '../../stores/branches'
import { useStagingStore } from '../../stores/staging'
import CommitGraph from './CommitGraph.vue'
import CommitDetailPanel from './CommitDetailPanel.vue'
import type { GraphCommit } from '../../stores/commits'

const commitsStore = useCommitsStore()
const repoStore = useRepositoryStore()
const branchesStore = useBranchesStore()
const stagingStore = useStagingStore()
const message = useMessage()
const dialog = useDialog()

const selectedCommit = ref<GraphCommit | null>(null)
const searchText = ref('')
const showDetail = ref(false)

const commits = computed(() => commitsStore.commits)
const loading = computed(() => commitsStore.loading)
const repo = computed(() => repoStore.currentRepo)

const branchOptions = computed(() => {
  const options: { label: string; value: string | null }[] = [
    { label: '当前分支', value: null },
    { label: '所有分支', value: '__all__' },
  ]
  // 本地分支
  for (const b of branchesStore.branches) {
    options.push({ label: b.name, value: b.name })
  }
  // 远程分支
  for (const rb of branchesStore.remoteBranches) {
    options.push({ label: rb, value: rb })
  }
  return options
})

function renderBranchLabel(option: { label: string; value: string | null }) {
  return h('span', { title: option.label }, option.label)
}

const filteredCommits = computed(() => {
  if (!searchText.value) return commits.value
  const q = searchText.value.toLowerCase()
  return commits.value.filter(c =>
    c.message.toLowerCase().includes(q) ||
    c.author.toLowerCase().includes(q) ||
    c.shortHash.includes(q)
  )
})

async function fetchCommits() {
  if (!repo.value) return
  await commitsStore.fetchGraphForCurrent(repo.value.path, branchesStore.current)
}

watch(() => commitsStore.branchFilter, () => {
  fetchCommits()
})

async function selectCommit(commit: GraphCommit) {
  selectedCommit.value = commit
  showDetail.value = true
}

function getActions() {
  if (!selectedCommit.value || !repo.value) return []
  const isFirst = commits.value[0]?.hash === selectedCommit.value.hash
  // 只有筛选"当前分支"时才显示回退操作
  const isCurrentBranchFilter = commitsStore.branchFilter === null
  const actions: { label: string; key: string }[] = []

  // Cherry-pick 所有提交都可以
  actions.push({ label: 'Cherry-pick', key: 'cherry-pick' })

  // 只有当前分支筛选时才允许回退操作
  if (isCurrentBranchFilter) {
    // 只有最新提交才显示回退最近提交
    if (isFirst) {
      actions.push({ label: '回退最近提交到暂存区', key: 'undo-last-soft' })
      actions.push({ label: '回退最近提交到工作区', key: 'undo-last-mixed' })
    }
    // 只有非最新提交才显示 Soft Reset 和 Mixed Reset
    if (!isFirst) {
      actions.push({ label: 'Soft Reset (保留暂存)', key: 'soft-reset' })
      actions.push({ label: 'Mixed Reset (保留工作区)', key: 'mixed-reset' })
    }
    // 只有最新提交才显示修改提交
    if (isFirst) {
      actions.push({ label: '修改提交 (Amend)', key: 'amend' })
    }
  }

  return actions
}

async function handleAction(key: string) {
  if (!selectedCommit.value || !repo.value) return
  const hash = selectedCommit.value.hash
  const shortHash = selectedCommit.value.shortHash

  // amend 操作使用自定义对话框
  if (key === 'amend') {
    showAmendDialog.value = true
    amendMessage.value = selectedCommit.value.message
    return
  }

  const actionMap: Record<string, { title: string; content: string; onConfirm: () => Promise<any> }> = {
    'cherry-pick': {
      title: '挑选提交',
      content: `确定要将提交 ${shortHash} 挑选到当前分支吗？`,
      onConfirm: () => window.electronAPI.git.cherryPick(repo.value!.path, hash),
    },
    'undo-last-soft': {
      title: '回退最近提交到暂存区',
      content: `确定要回退最近一次提交吗？更改将保留在暂存区。`,
      onConfirm: async () => {
        const result = await window.electronAPI.git.resetCommit(repo.value!.path, 'HEAD~1', 'soft')
        if (result?.success) {
          stagingStore.commitMessage = selectedCommit.value!.message
        }
        return result
      },
    },
    'undo-last-mixed': {
      title: '回退最近提交到工作区',
      content: `确定要回退最近一次提交吗？更改将保留在工作区。`,
      onConfirm: async () => {
        const result = await window.electronAPI.git.resetCommit(repo.value!.path, 'HEAD~1', 'mixed')
        if (result?.success) {
          stagingStore.commitMessage = selectedCommit.value!.message
        }
        return result
      },
    },
    'soft-reset': {
      title: 'Soft Reset',
      content: `确定要回退到提交 ${shortHash} 吗？更改将保留在暂存区。`,
      onConfirm: async () => {
        const result = await window.electronAPI.git.resetCommit(repo.value!.path, hash, 'soft')
        if (result?.success) {
          stagingStore.commitMessage = selectedCommit.value!.message
        }
        return result
      },
    },
    'mixed-reset': {
      title: 'Mixed Reset',
      content: `确定要回退到提交 ${shortHash} 吗？更改将保留在工作区。`,
      onConfirm: async () => {
        const result = await window.electronAPI.git.resetCommit(repo.value!.path, hash, 'mixed')
        if (result?.success) {
          stagingStore.commitMessage = selectedCommit.value!.message
        }
        return result
      },
    },
  }

  const action = actionMap[key]
  if (!action) return

  dialog.warning({
    title: action.title,
    content: action.content,
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        const result = await action.onConfirm()
        if (result?.success) {
          message.success(result.message)
          await Promise.all([
            fetchCommits(),
            stagingStore.fetchStatus(repo.value!.path),
            branchesStore.fetchBranches(repo.value!.path),
          ])
        } else if (result?.conflict) {
          message.warning(result.message || '有冲突，请在工作区解决')
          if (key === 'cherry-pick') {
            stagingStore.commitMessage = `cherry-pick ${shortHash}`
          }
          await stagingStore.fetchStatus(repo.value!.path)
        } else {
          message.error(result?.message || '操作失败')
        }
      } catch (e: any) {
        message.error('操作失败: ' + (e.message || String(e)))
      }
    },
  })
}

// Amend 对话框相关
const showAmendDialog = ref(false)
const amendMessage = ref('')
const amendLoading = ref(false)

async function handleAmend() {
  if (!repo.value || !amendMessage.value.trim()) return
  amendLoading.value = true
  try {
    const result = await window.electronAPI.git.amendCommit(repo.value.path, amendMessage.value.trim())
    if (result?.success) {
      message.success(result.message)
      showAmendDialog.value = false
      await Promise.all([
        fetchCommits(),
        stagingStore.fetchStatus(repo.value.path),
        branchesStore.fetchBranches(repo.value.path),
      ])
    } else {
      message.error(result?.message || '修改失败')
    }
  } catch (e: any) {
    message.error('修改失败: ' + (e.message || String(e)))
  } finally {
    amendLoading.value = false
  }
}
</script>

<template>
  <div class="commit-history">
    <div class="history-sidebar">
      <div class="filter-bar">
        <NSelect
          v-model:value="commitsStore.branchFilter"
          :options="branchOptions"
          :render-label="renderBranchLabel"
          size="small"
          style="width: 140px"
          placeholder="分支筛选"
        />
        <NInput
          v-model:value="searchText"
          placeholder="搜索提交信息、作者..."
          size="small"
          clearable
        >
          <template #prefix>&#128269;</template>
        </NInput>
      </div>
      <div class="commit-list" v-if="!loading">
        <NEmpty v-if="filteredCommits.length === 0" description="暂无提交记录" />
        <CommitGraph
          v-else
          :commits="filteredCommits"
          :selected-hash="selectedCommit?.hash"
          @select="selectCommit"
        />
      </div>
      <div v-else class="loading">
        <NSpin size="medium" />
      </div>
    </div>
    <div class="history-detail">
      <div v-if="selectedCommit && showDetail" class="detail-with-panel">
        <div class="detail-actions">
          <NSpace size="small">
            <NDropdown
              :options="getActions()"
              @select="handleAction"
              trigger="click"
            >
              <NButton size="small">操作</NButton>
            </NDropdown>
            <NButton size="small" @click="showDetail = false">关闭</NButton>
          </NSpace>
        </div>
        <CommitDetailPanel :commit="selectedCommit" @close="showDetail = false" />
      </div>
      <div v-else class="no-selection">
        <span>&#128064;</span>
        <p>选择一个提交查看详情</p>
      </div>
    </div>
  </div>

  <!-- Amend 对话框 -->
  <NModal v-model:show="showAmendDialog" preset="card" title="修改提交信息" style="width: 450px;">
    <NInput
      v-model:value="amendMessage"
      type="textarea"
      placeholder="输入新的提交信息"
      :autosize="{ minRows: 3, maxRows: 6 }"
      @keyup.enter.ctrl="handleAmend"
    />
    <template #footer>
      <NSpace justify="end">
        <NButton @click="showAmendDialog = false">取消</NButton>
        <NButton type="primary" :loading="amendLoading" :disabled="!amendMessage.trim()" @click="handleAmend">
          修改
        </NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<style scoped>
.commit-history {
  display: flex;
  height: 100%;
  overflow: hidden;
  min-height: 0;
}

.history-sidebar {
  width: 50%;
  min-width: 350px;
  max-width: 500px;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border-color);
  overflow: hidden;
  flex-shrink: 0;
}

.filter-bar {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
  display: flex;
  gap: 8px;
  align-items: center;
}

.commit-list {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  padding: 10px 0;
}

.loading {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.history-detail {
  flex: 1;
  overflow: hidden;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.detail-with-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.detail-actions {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.no-selection {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  gap: 8px;
}

.no-selection span {
  font-size: 48px;
}
</style>
