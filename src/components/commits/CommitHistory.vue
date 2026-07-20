<script setup lang="ts">
import { computed, ref } from 'vue'
import { NInput, NEmpty, NSpin } from 'naive-ui'
import { useCommitsStore } from '../../stores/commits'
import CommitGraph from './CommitGraph.vue'
import CommitDetail from './CommitDetail.vue'
import type { GraphCommit } from '../../stores/commits'

const commitsStore = useCommitsStore()
const selectedCommit = ref<GraphCommit | null>(null)
const searchText = ref('')

const commits = computed(() => commitsStore.commits)
const loading = computed(() => commitsStore.loading)

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
      <CommitDetail v-if="selectedCommit" :commit="selectedCommit" />
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
  overflow: auto;
  padding: 16px 20px;
  min-width: 0;
  min-height: 0;
}

.no-selection {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-muted);
  gap: 8px;
}

.no-selection span {
  font-size: 48px;
}
</style>
