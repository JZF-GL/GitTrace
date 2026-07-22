import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface FileChange {
  path: string
  index: string
  workingDir: string
  status: string
}

export const useStagingStore = defineStore('staging', () => {
  const files = ref<FileChange[]>([])
  const loading = ref(false)
  const selectedFiles = ref<Set<string>>(new Set())
  const commitMessage = ref('')
  const ahead = ref(0)
  const behind = ref(0)

  const stagedFiles = computed(() =>
    files.value.filter(f => f.index && f.index !== ' ' && f.index !== 'U' && f.index !== '?' && f.workingDir !== 'U')
  )

  const unstagedFiles = computed(() =>
    files.value.filter(f => f.index !== '?' && f.index !== 'U' && f.workingDir && f.workingDir !== ' ' && f.workingDir !== 'U')
  )

  const untrackedFiles = computed(() =>
    files.value.filter(f => f.index === '?' && f.workingDir === '?')
  )

  const conflictedFiles = computed(() =>
    files.value.filter(f => f.index === 'U' || f.workingDir === 'U')
  )

  async function fetchStatus(repoPath: string) {
    loading.value = true
    try {
      console.log('[StagingStore] fetchStatus called for:', repoPath)
      const status = await window.electronAPI.git.status(repoPath)
      console.log('[StagingStore] status received:', status)
      console.log('[StagingStore] status.files:', status.files)
      if (status && status.files) {
        files.value = status.files.map((f: any) => ({
          path: f.path,
          index: f.index,
          workingDir: f.working_dir,
          status: getStatusLabel(f),
        }))
      } else {
        files.value = []
      }
      ahead.value = status.ahead || 0
      behind.value = status.behind || 0
      console.log('[StagingStore] files set to:', files.value)
    } catch (e) {
      console.error('[StagingStore] fetchStatus error:', e)
      files.value = []
    } finally {
      loading.value = false
    }
  }

  function getStatusLabel(file: any): string {
    if (file.index === '?' && file.working_dir === '?') return 'untracked'
    if (file.index === 'A') return 'added'
    if (file.index === 'D' || file.working_dir === 'D') return 'deleted'
    if (file.index === 'R') return 'renamed'
    if (file.index === 'M' || file.working_dir === 'M') return 'modified'
    return 'unknown'
  }

  async function stageFiles(repoPath: string, paths: string[]) {
    try {
      console.log('[StagingStore] stageFiles:', paths)
      await window.electronAPI.git.add(repoPath, paths)
      await fetchStatus(repoPath)
    } catch (e) {
      console.error('[StagingStore] stageFiles error:', e)
    }
  }

  async function stageAll(repoPath: string) {
    try {
      console.log('[StagingStore] stageAll')
      await window.electronAPI.git.addAll(repoPath)
      await fetchStatus(repoPath)
    } catch (e) {
      console.error('[StagingStore] stageAll error:', e)
    }
  }

  async function unstageFiles(repoPath: string, paths: string[]) {
    try {
      console.log('[StagingStore] unstageFiles:', paths)
      await window.electronAPI.git.reset(repoPath, paths)
      await fetchStatus(repoPath)
    } catch (e) {
      console.error('[StagingStore] unstageFiles error:', e)
    }
  }

  function toggleSelect(path: string) {
    const newSet = new Set(selectedFiles.value)
    if (newSet.has(path)) {
      newSet.delete(path)
    } else {
      newSet.add(path)
    }
    selectedFiles.value = newSet
  }

  function clearSelection() {
    selectedFiles.value = new Set()
  }

  function clear() {
    files.value = []
    selectedFiles.value.clear()
    commitMessage.value = ''
  }

  return {
    files,
    loading,
    selectedFiles,
    commitMessage,
    ahead,
    behind,
    stagedFiles,
    unstagedFiles,
    untrackedFiles,
    conflictedFiles,
    fetchStatus,
    stageFiles,
    stageAll,
    unstageFiles,
    toggleSelect,
    clearSelection,
    clear,
  }
})
