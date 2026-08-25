<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue'
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
const backgroundFetches = new Map<string, Promise<void>>()

function refreshRemoteInBackground(repoPath: string, currentToken: number) {
  if (backgroundFetches.has(repoPath)) return

  const fetchPromise = (async () => {
    try {
      await window.electronAPI.git.fetch(repoPath)
      if (currentToken !== loadToken || repoStore.currentRepo?.path !== repoPath) return
      await branchesStore.fetchBranches(repoPath, { silent: true })
    } catch {
      // Background refresh must not interrupt normal repository usage.
    }
  })().finally(() => {
    backgroundFetches.delete(repoPath)
  })

  backgroundFetches.set(repoPath, fetchPromise)
}

function handleWindowFocus() {
  const repo = repoStore.currentRepo
  if (!repo || branchesStore.loading) return
  refreshRemoteInBackground(repo.path, loadToken)
}

onMounted(() => {
  window.addEventListener('focus', handleWindowFocus)
})

onUnmounted(() => {
  loadToken++
  window.removeEventListener('focus', handleWindowFocus)
})

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
  if (currentToken !== loadToken) return

  refreshRemoteInBackground(repo.path, currentToken)
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
