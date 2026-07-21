import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useCommitsStore } from './commits'
import { useStagingStore } from './staging'

export interface Branch {
  name: string
  current: boolean
}

export const useBranchesStore = defineStore('branches', () => {
  const branches = ref<Branch[]>([])
  const remoteBranches = ref<string[]>([])
  const current = ref<string>('')
  const loading = ref(false)

  async function fetchBranches(repoPath: string) {
    try {
      const result = await window.electronAPI.git.branchList(repoPath)
      // Update all at once to avoid flicker
      branches.value = result.local || []
      remoteBranches.value = result.remote || []
      current.value = result.current || ''
    } catch (e) {
      console.error('[BranchStore] fetchBranches error:', e)
    }
  }

  async function refreshAll(repoPath: string) {
    const commitsStore = useCommitsStore()
    const stagingStore = useStagingStore()
    await Promise.all([
      fetchBranches(repoPath),
      commitsStore.fetchGraph(repoPath),
      stagingStore.fetchStatus(repoPath),
    ])
  }

  async function createBranch(repoPath: string, name: string) {
    const result = await window.electronAPI.git.branchCreate(repoPath, name)
    await fetchBranches(repoPath)
    return result
  }

  async function deleteBranch(repoPath: string, name: string) {
    const result = await window.electronAPI.git.branchDelete(repoPath, name)
    await fetchBranches(repoPath)
    return result
  }

  async function checkout(repoPath: string, branch: string) {
    const result = await window.electronAPI.git.checkout(repoPath, branch)
    if (result?.success) {
      await refreshAll(repoPath)
    }
    return result
  }

  function clear() {
    branches.value = []
    remoteBranches.value = []
    current.value = ''
  }

  return { branches, remoteBranches, current, loading, fetchBranches, refreshAll, createBranch, deleteBranch, checkout, clear }
})
