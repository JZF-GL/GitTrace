<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { NButton, NInput, NModal, NDropdown, useMessage } from 'naive-ui'
import { useRepositoryStore } from '../../stores/repository'
import { useBranchesStore } from '../../stores/branches'
import { useStagingStore } from '../../stores/staging'
import { useCommitsStore } from '../../stores/commits'
import { useAppStore } from '../../stores/app'

const repoStore = useRepositoryStore()
const branchesStore = useBranchesStore()
const stagingStore = useStagingStore()
const commitsStore = useCommitsStore()
const appStore = useAppStore()
const message = useMessage()

const showNewBranch = ref(false)
const newBranchName = ref('')

// Context menu state
const contextMenu = ref({
  show: false,
  x: 0,
  y: 0,
  branch: '' as string,
  isCurrent: false,
  isRemote: false,
})

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

async function handleRefreshBranches() {
  if (!currentRepo.value) return
  await branchesStore.refreshAll(currentRepo.value.path)
  message.success('分支已刷新')
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

function showContextMenu(e: MouseEvent, branch: string, isCurrent: boolean, isRemote: boolean = false) {
  e.preventDefault()
  contextMenu.value = {
    show: true,
    x: e.clientX,
    y: e.clientY,
    branch,
    isCurrent,
    isRemote,
  }
}

function hideContextMenu() {
  contextMenu.value.show = false
}

onMounted(() => {
  document.addEventListener('click', hideContextMenu)
})

onUnmounted(() => {
  document.removeEventListener('click', hideContextMenu)
})

async function handleContextAction(action: string) {
  const { branch, isRemote } = contextMenu.value
  hideContextMenu()

  if (!currentRepo.value) return

  switch (action) {
    case 'checkout':
      await handleCheckout(branch)
      break
    case 'merge':
      await handleMergeBranch(branch)
      break
    case 'delete':
      await handleDeleteBranch(branch)
      break
    case 'sync':
      await handleSyncBranch(branch)
      break
    case 'pull-remote':
      await handlePullRemote(branch)
      break
  }
}

async function handlePullRemote(remoteBranch: string) {
  if (!currentRepo.value) return
  // remoteBranch 格式如 "origin/dev"，解析出 remote 名称
  const parts = remoteBranch.split('/')
  const remote = parts[0]
  const branch = parts.slice(1).join('/')

  message.loading('正在合并远程分支...')
  try {
    const result = await window.electronAPI.git.pull(currentRepo.value.path, remote, branch)
    if (result?.conflict) {
      message.warning('合并有冲突，请在工作区解决')
      // 自动填充合并提交信息
      stagingStore.commitMessage = `Merge branch '${branchesStore.current}' of ${currentRepo.value.path} into ${branchesStore.current}`
      appStore.setActiveTab('staging')
      await stagingStore.fetchStatus(currentRepo.value.path)
    } else if (result?.success) {
      message.success(`已将 ${remoteBranch} 合并到当前分支`)
    } else {
      message.error('合并失败: ' + (result?.message || '未知错误'))
    }
    await Promise.all([
      branchesStore.fetchBranches(currentRepo.value.path),
      commitsStore.fetchGraphForCurrent(currentRepo.value.path, branchesStore.current),
      stagingStore.fetchStatus(currentRepo.value.path),
    ])
  } catch (e: any) {
    message.error('合并失败: ' + (e.message || String(e)))
  }
}

async function handleMergeBranch(branch: string) {
  if (!currentRepo.value) return
  const result = await branchesStore.merge(currentRepo.value.path, branch)
  if (result?.success) {
    message.success(result.message || '合并成功')
    await Promise.all([
      branchesStore.fetchBranches(currentRepo.value.path),
      stagingStore.fetchStatus(currentRepo.value.path),
      commitsStore.fetchGraphForCurrent(currentRepo.value.path, branchesStore.current),
    ])
  } else if (result?.conflict) {
    message.warning(result.message || '合并有冲突，请在工作区解决')
    // 自动填充合并提交信息
    const repoName = currentRepo.value.name
    stagingStore.commitMessage = `Merge branch '${branchesStore.current}' into ${branch}`
    appStore.setActiveTab('staging')
    await stagingStore.fetchStatus(currentRepo.value.path)
  } else {
    message.error('合并失败: ' + (result?.message || '未知错误'))
  }
}

async function handleSyncBranch(branch: string) {
  if (!currentRepo.value) return
  message.loading('正在同步...')
  try {
    // 先拉取
    const pullResult = await window.electronAPI.git.pull(currentRepo.value.path, undefined, branch)
    if (pullResult?.conflict) {
      message.warning('拉取有冲突，请在工作区解决')
      appStore.setActiveTab('staging')
      await stagingStore.fetchStatus(currentRepo.value.path)
      return
    }
    if (!pullResult?.success) {
      message.error('拉取失败: ' + (pullResult?.message || '未知错误'))
      return
    }
    // 再推送
    const pushResult = await window.electronAPI.git.push(currentRepo.value.path, undefined, branch)
    if (!pushResult?.success) {
      message.error('推送失败: ' + (pushResult?.message || '未知错误'))
      return
    }
    message.success(`分支 ${branch} 同步成功`)
    await Promise.all([
      branchesStore.fetchBranches(currentRepo.value.path),
      stagingStore.fetchStatus(currentRepo.value.path),
      commitsStore.fetchGraphForCurrent(currentRepo.value.path, branchesStore.current),
    ])
  } catch (e: any) {
    message.error('同步失败: ' + (e.message || String(e)))
  }
}
</script>

<template>
  <div class="sidebar">
    <!-- Repo list section -->
    <div class="sidebar-section">
      <div class="section-header">
        <span class="section-title">仓库</span>
        <NButton text size="small" @click="openFolder">+</NButton>
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
        <div class="section-actions">
          <button class="action-icon" @click="handleRefreshBranches" title="刷新分支">&#8635;</button>
          <NButton text size="small" @click="showNewBranch = true">+</NButton>
        </div>
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
            @dblclick="handleCheckout(branch.name)"
            @contextmenu="showContextMenu($event, branch.name, branch.current)"
          >
            <span class="branch-icon local">&#128204;</span>
            <span class="branch-name">{{ branch.name }}</span>
            <span v-if="branch.ahead && branch.ahead > 0" class="branch-badge ahead">&#8593;{{ branch.ahead }}</span>
            <span v-if="branch.behind && branch.behind > 0" class="branch-badge behind">&#8595;{{ branch.behind }}</span>
          </div>
        </div>

        <!-- Remote branches -->
        <div v-if="remoteBranches.length > 0" class="branch-group">
          <div class="branch-group-title">远程分支</div>
          <div
            v-for="remote in remoteBranches"
            :key="remote"
            class="branch-item remote"
            @contextmenu="showContextMenu($event, remote, false, true)"
          >
            <span class="branch-icon remote">&#128279;</span>
            <span class="branch-name">{{ formatRemoteBranch(remote) }}</span>
          </div>
        </div>

        <!-- Context menu -->
        <Teleport to="body">
          <div
            v-if="contextMenu.show"
            class="context-menu"
            :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
          >
            <!-- 本地分支菜单 -->
            <template v-if="!contextMenu.isRemote">
              <div v-if="!contextMenu.isCurrent" class="context-menu-item" @click="handleContextAction('checkout')">
                切换到此分支
              </div>
              <div class="context-menu-item" @click="handleContextAction('sync')">
                同步
              </div>
              <div v-if="!contextMenu.isCurrent" class="context-menu-item" @click="handleContextAction('merge')">
                合并到当前分支
              </div>
              <div v-if="!contextMenu.isCurrent" class="context-menu-item danger" @click="handleContextAction('delete')">
                删除分支
              </div>
            </template>
            <!-- 远程分支菜单 -->
            <template v-else>
              <div class="context-menu-item" @click="handleContextAction('pull-remote')">
                合并远程到当前分支
              </div>
            </template>
          </div>
        </Teleport>

        <div v-if="branches.length === 0 && remoteBranches.length === 0" class="no-branches">暂无分支</div>
      </div>
    </div>

    <!-- New branch modal -->
    <NModal v-model:show="showNewBranch" title="创建新分支">
      <div class="modal-content">
        <NInput
          v-model:value="newBranchName"
          placeholder="分支名称"
          @keyup.enter="handleCreateBranch"
        />
        <NButton
          type="primary"
          style="margin-top: 12px; width: 100%"
          @click="handleCreateBranch"
          :disabled="!newBranchName"
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

.section-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.section-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-secondary);
  letter-spacing: 0.5px;
}

.section-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.action-icon {
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 16px;
  padding: 4px 6px;
  border-radius: 4px;
  transition: all 0.15s;
}

.action-icon:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
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

.branch-badge {
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 8px;
  font-weight: 500;
}

.branch-badge.ahead {
  background: rgba(63, 185, 80, 0.2);
  color: var(--accent-green);
}

.branch-badge.behind {
  background: rgba(248, 81, 73, 0.2);
  color: var(--accent-red);
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

.context-menu {
  position: fixed;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 4px 0;
  min-width: 160px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
}

.context-menu-item {
  padding: 8px 12px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-primary);
  transition: background 0.1s;
}

.context-menu-item:hover {
  background: var(--bg-hover);
}

.context-menu-item.danger {
  color: var(--accent-red);
}

.context-menu-item.danger:hover {
  background: rgba(248, 81, 73, 0.15);
}
</style>
