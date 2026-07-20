import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface RepoEntry {
  id: string
  name: string
  path: string
  addedAt: string
}

export const useRepositoryStore = defineStore('repository', () => {
  const repos = ref<RepoEntry[]>([])
  const currentRepo = ref<RepoEntry | null>(null)
  const loading = ref(false)

  async function loadRepos() {
    repos.value = await window.electronAPI.repo.list()
  }

  async function addRepo(path: string) {
    const entry = await window.electronAPI.repo.add(path)
    await loadRepos()
    return entry
  }

  async function removeRepo(id: string) {
    await window.electronAPI.repo.remove(id)
    await loadRepos()
    if (currentRepo.value?.id === id) {
      currentRepo.value = repos.value.length > 0 ? repos.value[0] : null
    }
  }

  function selectRepo(repo: RepoEntry | null) {
    currentRepo.value = repo
  }

  return { repos, currentRepo, loading, loadRepos, addRepo, removeRepo, selectRepo }
})
