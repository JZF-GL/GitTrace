<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRepositoryStore } from '../stores/repository'
import { useCommitsStore } from '../stores/commits'
import { useStagingStore } from '../stores/staging'
import { useBranchesStore } from '../stores/branches'
import TitleBar from '../components/layout/TitleBar.vue'
import Sidebar from '../components/layout/Sidebar.vue'
import RepoView from '../components/repository/RepoView.vue'
import EmptyState from '../components/layout/EmptyState.vue'

const repoStore = useRepositoryStore()
const commitsStore = useCommitsStore()
const stagingStore = useStagingStore()
const branchesStore = useBranchesStore()

const hasRepo = computed(() => !!repoStore.currentRepo)

watch(() => repoStore.currentRepo, async (repo) => {
  if (!repo) {
    commitsStore.clear()
    stagingStore.clear()
    branchesStore.clear()
    return
  }
  await branchesStore.fetchBranches(repo.path)
  await Promise.all([
    commitsStore.fetchGraphForCurrent(repo.path, branchesStore.current),
    stagingStore.fetchStatus(repo.path),
  ])
}, { immediate: true })
</script>

<template>
  <div class="app-container">
    <TitleBar />
    <div class="app-layout">
      <Sidebar />
      <div class="main-content">
        <RepoView v-if="hasRepo" />
        <EmptyState v-else />
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
}
</style>
