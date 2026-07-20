import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface GraphCommit {
  hash: string
  shortHash: string
  parentHashes: string[]
  author: string
  date: string
  message: string
  column: number
  isMerge: boolean
  branch: string[]
}

export const useCommitsStore = defineStore('commits', () => {
  const commits = ref<GraphCommit[]>([])
  const loading = ref(false)
  const maxCount = ref(200)

  async function fetchGraph(repoPath: string) {
    loading.value = true
    try {
      const raw = await window.electronAPI.git.logGraph(repoPath, maxCount.value)
      commits.value = parseGraphOutput(raw)
    } finally {
      loading.value = false
    }
  }

  function parseGraphOutput(raw: string): GraphCommit[] {
    const lines = raw.split('\n').filter(l => l.trim())
    const result: GraphCommit[] = []
    const columnMap = new Map<string, number>()
    let nextColumn = 0

    for (const line of lines) {
      const match = line.match(/^(.+)\|(.*)\|(.*)\|(.*)\|(.*)\|(.*)$/)
      if (!match) continue

      const [, hash, parentHashes, shortHash, author, date, message] = match
      const parents = parentHashes ? parentHashes.split(' ') : []
      const isMerge = parents.length > 1

      let column = columnMap.get(hash)
      if (column === undefined) {
        column = nextColumn++
        columnMap.set(hash, column)
      }

      for (const parent of parents) {
        if (!columnMap.has(parent)) {
          columnMap.set(parent, column)
        }
      }

      result.push({
        hash,
        shortHash,
        parentHashes: parents,
        author,
        date,
        message,
        column,
        isMerge,
        branch: [],
      })
    }

    return result
  }

  function clear() {
    commits.value = []
  }

  return { commits, loading, maxCount, fetchGraph, clear }
})
