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

  const stagedFiles = computed(() =>
    files.value.filter(f => f.index && f.index !== ' ')
  )

  const unstagedFiles = computed(() =>
    files.value.filter(f => f.workingDir && f.workingDir !== ' ')
  )

  const untrackedFiles = computed(() =>
    files.value.filter(f => f.index === '?' && f.workingDir === '?')
  )

  async function fetchStatus(repoPath: string) {
    loading.value = true
    try {
      const status = await window.electronAPI.git.status(repoPath)
      files.value = status.files.map((f: any) => ({
        path: f.path,
        index: f.index,
        workingDir: f.working_dir,
        status: getStatusLabel(f),
      }))
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
    await window.electronAPI.git.add(repoPath, paths)
    await fetchStatus(repoPath)
  }

  async function stageAll(repoPath: string) {
    await window.electronAPI.git.addAll(repoPath)
    await fetchStatus(repoPath)
  }

  async function unstageFiles(repoPath: string, paths: string[]) {
    await window.electronAPI.git.reset(repoPath, paths)
    await fetchStatus(repoPath)
  }

  function toggleSelect(path: string) {
    if (selectedFiles.value.has(path)) {
      selectedFiles.value.delete(path)
    } else {
      selectedFiles.value.add(path)
    }
  }

  function clearSelection() {
    selectedFiles.value.clear()
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
    stagedFiles,
    unstagedFiles,
    untrackedFiles,
    fetchStatus,
    stageFiles,
    stageAll,
    unstageFiles,
    toggleSelect,
    clearSelection,
    clear,
  }
})
