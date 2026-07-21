import { defineStore } from 'pinia'
import { ref } from 'vue'

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
    loading.value = true
    try {
      const result = await window.electronAPI.git.branchList(repoPath)
      console.log('[BranchStore] fetchBranches result:', result)
      branches.value = result.local || []
      remoteBranches.value = result.remote || []
      current.value = result.current || ''
      console.log('[BranchStore] branches set to:', branches.value)
    } catch (e) {
      console.error('[BranchStore] fetchBranches error:', e)
    } finally {
      loading.value = false
    }
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
    await fetchBranches(repoPath)
    return result
  }

  function clear() {
    branches.value = []
    remoteBranches.value = []
    current.value = ''
  }

  return { branches, remoteBranches, current, loading, fetchBranches, createBranch, deleteBranch, checkout, clear }
})
