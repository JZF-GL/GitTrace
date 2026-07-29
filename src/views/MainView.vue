<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRepositoryStore } from '../stores/repository'
import { useCommitsStore } from '../stores/commits'
import { useStagingStore } from '../stores/staging'
import { useBranchesStore } from '../stores/branches'
import { useAppStore } from '../stores/app'
import TitleBar from '../components/layout/TitleBar.vue'
import Sidebar from '../components/layout/Sidebar.vue'
import RepoView from '../components/repository/RepoView.vue'
import EmptyState from '../components/layout/EmptyState.vue'

const repoStore = useRepositoryStore()
const commitsStore = useCommitsStore()
const stagingStore = useStagingStore()
const branchesStore = useBranchesStore()
const appStore = useAppStore()

const hasRepo = computed(() => !!repoStore.currentRepo)

let loadToken = 0

watch(() => repoStore.currentRepo, async (repo) => {
  const currentToken = ++loadToken

  if (!repo) {
    commitsStore.clear()
    stagingStore.clear()
    branchesStore.clear()
    return
  }

  branchesStore.clear()
  commitsStore.clear()
  stagingStore.clear()

  appStore.setActiveTab('history')

  await branchesStore.fetchBranches(repo.path)
  if (currentToken !== loadToken) return

  await Promise.all([
    commitsStore.fetchGraphForCurrent(repo.path, branchesStore.current),
    stagingStore.fetchStatus(repo.path),
  ])
}, { immediate: true })

watch(() => appStore.activeTab, async (tab) => {
  if (tab === 'staging' && repoStore.currentRepo) {
    await stagingStore.fetchStatus(repoStore.currentRepo.path)
  }
})
</script>

<template>
  <div class="app-container">
    <TitleBar />
    <div class="app-layout">
      <Sidebar v-show="!appStore.sidebarCollapsed" />
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
