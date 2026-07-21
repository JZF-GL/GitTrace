<script setup lang="ts">
import { computed, ref } from 'vue'
import { NInput, NEmpty, NSpin, NButton, NSpace, NDropdown, useMessage } from 'naive-ui'
import { useCommitsStore } from '../../stores/commits'
import { useRepositoryStore } from '../../stores/repository'
import { useStagingStore } from '../../stores/staging'
import CommitGraph from './CommitGraph.vue'
import CommitDetailPanel from './CommitDetailPanel.vue'
import type { GraphCommit } from '../../stores/commits'

const commitsStore = useCommitsStore()
const repoStore = useRepositoryStore()
const stagingStore = useStagingStore()
const message = useMessage()

const selectedCommit = ref<GraphCommit | null>(null)
const searchText = ref('')
const showDetail = ref(false)

const commits = computed(() => commitsStore.commits)
const loading = computed(() => commitsStore.loading)
const repo = computed(() => repoStore.currentRepo)

const filteredCommits = computed(() => {
  if (!searchText.value) return commits.value
  const q = searchText.value.toLowerCase()
  return commits.value.filter(c =>
    c.message.toLowerCase().includes(q) ||
    c.author.toLowerCase().includes(q) ||
    c.shortHash.includes(q)
  )
})

function selectCommit(commit: GraphCommit) {
  selectedCommit.value = commit
  showDetail.value = true
}

function getActions() {
  if (!selectedCommit.value || !repo.value) return []
  const isFirst = commits.value[0]?.hash === selectedCommit.value.hash
  return [
    { label: 'Cherry-pick', key: 'cherry-pick' },
    { label: 'Soft Reset (保留暂存)', key: 'soft-reset' },
    { label: 'Mixed Reset (保留工作区)', key: 'mixed-reset' },
    ...(isFirst ? [{ label: '修改提交 (Amend)', key: 'amend' }] : []),
  ]
}

async function handleAction(key: string) {
  if (!selectedCommit.value || !repo.value) return
  const hash = selectedCommit.value.hash
  let result: any

  switch (key) {
    case 'cherry-pick':
      result = await window.electronAPI.git.cherryPick(repo.value.path, hash)
      break
    case 'soft-reset':
      result = await window.electronAPI.git.resetCommit(repo.value.path, hash, 'soft')
      break
    case 'mixed-reset':
      result = await window.electronAPI.git.resetCommit(repo.value.path, hash, 'mixed')
      break
    case 'amend':
      result = await window.electronAPI.git.amendCommit(repo.value.path, selectedCommit.value.message)
      break
  }

  if (result?.success) {
    message.success(result.message)
    await Promise.all([
      commitsStore.fetchGraph(repo.value.path),
      stagingStore.fetchStatus(repo.value.path),
    ])
  } else {
    message.error(result?.message || '操作失败')
  }
}
</script>

<template>
  <div class="commit-history">
    <div class="history-sidebar">
      <div class="search-bar">
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
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border-color);
  overflow: hidden;
  flex-shrink: 0;
}

.search-bar {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
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
