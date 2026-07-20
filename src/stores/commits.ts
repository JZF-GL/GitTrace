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
      console.log('[CommitsStore] raw log output:', raw.substring(0, 500))
      const parsed = parseGraphOutput(raw)
      console.log('[CommitsStore] parsed commits:', parsed.map(c => ({ hash: c.shortHash, column: c.column, parents: c.parentHashes.length })))
      commits.value = parsed
    } finally {
      loading.value = false
    }
  }

  function parseGraphOutput(raw: string): GraphCommit[] {
    const lines = raw.split('\n').filter(l => l.trim())
    const result: GraphCommit[] = []

    // First pass: collect all data in reverse order (git log outputs newest first)
    const hashes: string[] = []
    const parentHashesMap = new Map<string, string[]>()
    const metaMap = new Map<string, { shortHash: string; author: string; date: string; message: string }>()

    for (const line of lines) {
      const match = line.match(/^(.+)\|(.*)\|(.*)\|(.*)\|(.*)\|(.*)$/)
      if (!match) continue
      const [, hash, parentsStr, shortHash, author, date, message] = match
      hashes.push(hash)
      parentHashesMap.set(hash, parentsStr ? parentsStr.split(' ') : [])
      metaMap.set(hash, { shortHash, author, date, message })
    }

    // Second pass: assign columns
    // Strategy: each commit continues its parent's column (first parent = main line)
    // Only merge commits' second parents get new columns
    const columnMap = new Map<string, number>()
    let nextColumn = 1 // column 0 is the main line

    // Start from the oldest commit (reverse order)
    for (let i = hashes.length - 1; i >= 0; i--) {
      const hash = hashes[i]
      const parents = parentHashesMap.get(hash) || []

      // Assign column to parents first (they come later in time)
      for (let p = 0; p < parents.length; p++) {
        const parentHash = parents[p]
        if (!columnMap.has(parentHash)) {
          if (p === 0) {
            // First parent is on the same line
            // Will be set when we process this commit
          } else {
            // Other parents (merge sources) get new columns
            columnMap.set(parentHash, nextColumn++)
          }
        }
      }

      // Now assign column to this commit
      if (!columnMap.has(hash)) {
        if (parents.length > 0) {
          // Inherit first parent's column (or use 0 if not set yet)
          columnMap.set(hash, columnMap.get(parents[0]) ?? 0)
        } else {
          // Root commit
          columnMap.set(hash, 0)
        }
      }

      // First parent inherits this commit's column
      if (parents.length > 0 && !columnMap.has(parents[0])) {
        columnMap.set(parents[0], columnMap.get(hash)!)
      }
    }

    // Third pass: build result in original order (newest first)
    for (let i = 0; i < hashes.length; i++) {
      const hash = hashes[i]
      const parents = parentHashesMap.get(hash) || []
      const meta = metaMap.get(hash)!

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
      })
    }

    return result
  }

  function clear() {
    commits.value = []
  }

  return { commits, loading, maxCount, fetchGraph, clear }
})
