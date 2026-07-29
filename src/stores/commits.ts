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
  pushed?: boolean
  refs?: string
}

export const useCommitsStore = defineStore('commits', () => {
  const commits = ref<GraphCommit[]>([])
  const loading = ref(false)
  const maxCount = ref(200)
  const branchFilter = ref<string | null>(null)
  let fetchRequestId = 0

  async function fetchGraph(repoPath: string, branch?: string) {
    const currentRequestId = ++fetchRequestId
    loading.value = true
    try {
      const raw = await window.electronAPI.git.logGraph(repoPath, maxCount.value, branch)
      if (currentRequestId !== fetchRequestId) return
      console.log('[CommitsStore] raw log output:', raw.substring(0, 500))
      const parsed = parseGraphOutput(raw)

      const remoteCommits = await window.electronAPI.git.remoteCommits(repoPath)
      if (currentRequestId !== fetchRequestId) return
      const remoteHashSet = new Set(remoteCommits)

      for (const commit of parsed) {
        commit.pushed = remoteHashSet.has(commit.hash)
      }

      console.log('[CommitsStore] parsed commits:', parsed.map(c => ({ hash: c.shortHash, column: c.column, parents: c.parentHashes.length })))
      commits.value = parsed
    } finally {
      if (currentRequestId === fetchRequestId) {
        loading.value = false
      }
    }
  }

  async function fetchGraphForCurrent(repoPath: string, currentBranch: string) {
    const branch = branchFilter.value === '__all__' ? undefined : branchFilter.value || currentBranch
    await fetchGraph(repoPath, branch)
  }

  function parseGraphOutput(raw: string): GraphCommit[] {
    const lines = raw.split('\n').filter(l => l.trim())
    const result: GraphCommit[] = []

    // First pass: collect all data (git log outputs newest first)
    const hashes: string[] = []
    const parentHashesMap = new Map<string, string[]>()
    const metaMap = new Map<string, { shortHash: string; author: string; date: string; message: string; refs: string }>()

    for (const line of lines) {
      const match = line.match(/^(.*)\|(.*)\|(.*)\|(.*)\|(.*)\|(.*)\|(.*)$/)
      if (!match) continue
      const [, refs, hash, parentsStr, shortHash, author, date, message] = match
      hashes.push(hash)
      parentHashesMap.set(hash, parentsStr ? parentsStr.split(' ') : [])
      metaMap.set(hash, { shortHash, author, date, message, refs })
    }

    // Build hash to index lookup
    const hashToIndex = new Map<string, number>()
    for (let i = 0; i < hashes.length; i++) {
      hashToIndex.set(hashes[i], i)
    }

    // Second pass: assign columns
    // Strategy: Main line is always column 0
    // When a merge happens, the merge source (second parent) and its ancestors
    // are on column 1 until they merge back to column 0
    const columnMap = new Map<string, number>()

    // First: identify which commits are on the main line
    // Main line = following first parent chain from HEAD
    const onMainLine = new Set<string>()
    {
      let currentHash = hashes[0] // HEAD
      while (currentHash && hashToIndex.has(currentHash)) {
        onMainLine.add(currentHash)
        const idx = hashToIndex.get(currentHash)!
        const parents = parentHashesMap.get(currentHash) || []
        if (parents.length > 0) {
          currentHash = parents[0] // Follow first parent
        } else {
          break
        }
      }
    }

    // Second: assign columns
    // Main line commits -> column 0
    // Branch line commits -> column 1
    for (let i = hashes.length - 1; i >= 0; i--) {
      const hash = hashes[i]

      if (onMainLine.has(hash)) {
        columnMap.set(hash, 0)
      } else {
        // Not on main line -> branch line -> column 1
        columnMap.set(hash, 1)
      }
    }

    // Third pass: build result in original order (newest first)
    for (let i = 0; i < hashes.length; i++) {
      const hash = hashes[i]
      const parents = parentHashesMap.get(hash) || []
      const meta = metaMap.get(hash)!

      const refs = meta.refs ? meta.refs.trim() : ''

      result.push({
        hash,
        shortHash: meta.shortHash,
        parentHashes: parents,
        author: meta.author,
        date: meta.date,
        message: meta.message,
        column: columnMap.get(hash) ?? 0,
        isMerge: parents.length > 1,
        branch: [],
        refs,
      })
    }

    return result
  }

  function clear() {
    commits.value = []
    branchFilter.value = null
  }

  function resetFilter() {
    branchFilter.value = null
  }

  return { commits, loading, maxCount, branchFilter, fetchGraph, fetchGraphForCurrent, resetFilter, clear }
})
