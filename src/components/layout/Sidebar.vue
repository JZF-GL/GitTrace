<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { NButton, NInput, NModal, NForm, NFormItem, NSelect, useMessage } from 'naive-ui'
import { useRepositoryStore } from '../../stores/repository'
import { useBranchesStore } from '../../stores/branches'

const repoStore = useRepositoryStore()
const branchesStore = useBranchesStore()
const message = useMessage()

const showNewBranch = ref(false)
const newBranchName = ref('')

const currentRepo = computed(() => repoStore.currentRepo)
const branches = computed(() => branchesStore.branches)
const remoteBranches = computed(() => branchesStore.remoteBranches)
const currentBranch = computed(() => branchesStore.current)

function formatRemoteBranch(remote: string): string {
  // origin/feature/foo -> feature/foo
  const parts = remote.split('/')
  if (parts.length > 1) {
    return parts.slice(1).join('/')
  }
  return remote
}

async function openFolder() {
  const path = await window.electronAPI.dialog.openFolder()
  if (path) {
    const entry = await repoStore.addRepo(path)
    repoStore.selectRepo(entry)
  }
}

async function selectRepo(repo: any) {
  repoStore.selectRepo(repo)
}

async function handleCreateBranch() {
  if (!currentRepo.value || !newBranchName.value) return
  const result = await branchesStore.createBranch(currentRepo.value.path, newBranchName.value)
  if (result?.success) {
    message.success(result.message)
  } else {
    message.error('创建失败: ' + (result?.message || '未知错误'))
  }
  newBranchName.value = ''
  showNewBranch.value = false
}

async function handleCheckout(branch: string) {
  if (!currentRepo.value) return
  const result = await branchesStore.checkout(currentRepo.value.path, branch)
  if (result?.success) {
    message.success(result.message)
  } else {
    message.error('切换失败: ' + (result?.message || '未知错误'))
  }
}

async function handleDeleteBranch(name: string) {
  if (!currentRepo.value) return
  const result = await branchesStore.deleteBranch(currentRepo.value.path, name)
  if (result?.success) {
    message.success(result.message)
  } else {
    message.error('删除失败: ' + (result?.message || '未知错误'))
  }
}
</script>

<template>
  <div class="sidebar">
    <!-- Repo list section -->
    <div class="sidebar-section">
      <div class="section-header">
        <span class="section-title">仓库</span>
        <NButton text size="tiny" @click="openFolder">+</NButton>
      </div>
      <div class="repo-list">
        <div
          v-for="repo in repoStore.repos"
          :key="repo.id"
          class="repo-item"
          :class="{ active: currentRepo?.id === repo.id }"
          @click="selectRepo(repo)"
        >
          <span class="repo-icon">&#128451;</span>
          <div class="repo-info">
            <span class="repo-name">{{ repo.name }}</span>
            <span class="repo-path">{{ repo.path }}</span>
          </div>
          <button
            class="remove-btn"
            @click.stop="repoStore.removeRepo(repo.id)"
            title="移除仓库"
          >&#10005;</button>
        </div>
      </div>
    </div>

    <!-- Branches section -->
    <div v-if="currentRepo" class="sidebar-section branches-section">
      <div class="section-header">
        <span class="section-title">分支</span>
        <NButton text size="tiny" @click="showNewBranch = true">+</NButton>
      </div>
      <div class="branch-list">
        <!-- Local branches -->
        <div v-if="branches.length > 0" class="branch-group">
          <div class="branch-group-title">本地分支</div>
          <div
            v-for="branch in branches"
            :key="branch.name"
            class="branch-item"
            :class="{ current: branch.current }"
            @click="handleCheckout(branch.name)"
          >
            <span class="branch-icon local">&#128204;</span>
            <span class="branch-name">{{ branch.name }}</span>
            <button
              v-if="!branch.current"
              class="remove-btn"
              @click.stop="handleDeleteBranch(branch.name)"
              title="删除分支"
            >&#10005;</button>
          </div>
        </div>

        <!-- Remote branches -->
        <div v-if="remoteBranches.length > 0" class="branch-group">
          <div class="branch-group-title">远程分支</div>
          <div
            v-for="remote in remoteBranches"
            :key="remote"
            class="branch-item remote"
          >
            <span class="branch-icon remote">&#128279;</span>
            <span class="branch-name">{{ formatRemoteBranch(remote) }}</span>
          </div>
        </div>

        <div v-if="branches.length === 0 && remoteBranches.length === 0" class="no-branches">暂无分支</div>
      </div>
    </div>

    <!-- New branch modal -->
    <NModal v-model:show="showNewBranch" title="创建新分支">
      <div class="modal-content">
        <NInput
          v-model:value="newBranchName.value"
          placeholder="分支名称"
          @keyup.enter="handleCreateBranch"
        />
        <NButton
          type="primary"
          style="margin-top: 12px; width: 100%"
          @click="handleCreateBranch"
          :disabled="!newBranchName.value"
        >
          创建
        </NButton>
      </div>
    </NModal>
  </div>
</template>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.sidebar-section {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar-section + .sidebar-section {
  border-top: 1px solid var(--border-color);
}

.branches-section {
  flex: 1;
  overflow: hidden;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--bg-secondary);
}

.section-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-secondary);
  letter-spacing: 0.5px;
}

.repo-list, .branch-list {
  overflow-y: auto;
  flex: 1;
}

.repo-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  border-left: 2px solid transparent;
  transition: background 0.15s;
}

.repo-item:hover {
  background: var(--bg-hover);
}

.repo-item.active {
  background: var(--bg-tertiary);
  border-left-color: var(--accent-blue);
}

.repo-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.repo-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.repo-name {
  font-size: 13px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.repo-path {
  font-size: 11px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.remove-btn {
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 12px;
  padding: 2px 4px;
  border-radius: 4px;
  opacity: 0;
  transition: opacity 0.15s;
}

.repo-item:hover .remove-btn,
.branch-item:hover .remove-btn {
  opacity: 1;
}

.remove-btn:hover {
  background: rgba(248, 81, 73, 0.2);
  color: var(--accent-red);
}

.branch-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.15s;
}

.branch-item:hover {
  background: var(--bg-hover);
}

.branch-item.current {
  background: var(--bg-tertiary);
  color: var(--accent-blue);
}

.branch-item.remote {
  color: var(--text-secondary);
  cursor: default;
}

.branch-icon {
  font-size: 12px;
  color: var(--accent-purple);
}

.branch-icon.remote {
  color: var(--text-muted);
}

.branch-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.branch-group {
  margin-bottom: 4px;
}

.branch-group-title {
  font-size: 11px;
  color: var(--text-muted);
  padding: 8px 12px 4px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.no-branches {
  padding: 12px;
  text-align: center;
  color: var(--text-muted);
  font-size: 12px;
}

.modal-content {
  background: var(--bg-secondary);
  padding: 24px;
  border-radius: 8px;
  min-width: 300px;
}
</style>
