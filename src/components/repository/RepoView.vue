<script setup lang="ts">
import { computed } from 'vue'
import { NTabs, NTabPane } from 'naive-ui'
import { useRepositoryStore } from '../../stores/repository'
import { useCommitsStore } from '../../stores/commits'
import { useStagingStore } from '../../stores/staging'
import { useBranchesStore } from '../../stores/branches'
import { useAppStore } from '../../stores/app'
import CommitHistory from '../commits/CommitHistory.vue'
import StagingArea from '../staging/StagingArea.vue'
import RemotePanel from '../remote/RemotePanel.vue'
import StashPanel from '../stash/StashPanel.vue'
import Terminal from '../terminal/Terminal.vue'

const repoStore = useRepositoryStore()
const commitsStore = useCommitsStore()
const stagingStore = useStagingStore()
const branchesStore = useBranchesStore()
const appStore = useAppStore()

const activeTab = computed({
  get: () => appStore.activeTab,
  set: (val) => appStore.setActiveTab(val),
})

const repo = computed(() => repoStore.currentRepo)
const fileCount = computed(() => stagingStore.files.length)
const branchName = computed(() => branchesStore.current)

async function handleRefresh() {
  if (!repo.value) return
  await Promise.all([
    commitsStore.fetchGraphForCurrent(repo.value.path, branchesStore.current),
    stagingStore.fetchStatus(repo.value.path),
    branchesStore.fetchBranches(repo.value.path),
  ])
}
</script>

<template>
  <div class="repo-view">
    <!-- Top action bar -->
    <div class="action-bar">
      <div class="action-bar-left">
        <span class="repo-label">&#128451; {{ repo?.name }}</span>
        <span class="branch-label">
          <span class="branch-icon">&#128204;</span>
          {{ branchName }}
        </span>
      </div>
      <div class="action-bar-right">
        <button class="action-btn" @click="handleRefresh" title="刷新">&#8635;</button>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tab-container">
      <NTabs v-model:value="activeTab" type="line" animated :tab-bar-gutter="20">
        <NTabPane name="history" tab="提交历史">
          <div class="tab-content">
            <CommitHistory />
          </div>
        </NTabPane>
        <NTabPane name="staging" :tab="`工作区${fileCount > 0 ? ' (' + fileCount + ')' : ''}`">
          <div class="tab-content">
            <StagingArea />
          </div>
        </NTabPane>
        <NTabPane name="remote" tab="远程">
          <div class="tab-content">
            <RemotePanel />
          </div>
        </NTabPane>
        <NTabPane name="stash" tab="Stash">
          <div class="tab-content">
            <StashPanel />
          </div>
        </NTabPane>
        <NTabPane name="terminal" tab="终端">
          <div class="tab-content">
            <Terminal />
          </div>
        </NTabPane>
      </NTabs>
    </div>
  </div>
</template>

<style scoped>
.repo-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 20px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}

.action-bar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.repo-label {
  font-weight: 600;
  font-size: 14px;
}

.branch-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--accent-purple);
  background: rgba(188, 140, 255, 0.1);
  padding: 2px 8px;
  border-radius: 12px;
}

.branch-icon {
  font-size: 10px;
}

.action-btn {
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 16px;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.15s;
}

.action-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.tab-container {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

:deep(.n-tabs) {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

:deep(.n-tabs-tab .n-tabs-tab__label) {
  padding: 10px 20px;
}

:deep(.n-tabs-tab-pad){
  width: 10px;
}

:deep(.n-tabs-tab) {
  font-size: 13px;
  padding: 0;
}

:deep(.n-tabs-pane-wrapper){
  height: 100%;
}

:deep(.n-tab-pane){
  height: 100%;
  min-height: 100%;
  padding-top: 0 !important;
}

:deep(.n-tabs-tab-pane) {
  flex: 1;
  min-height: 0;
}

.tab-content {
  height: 100%;
}
</style>
