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

  function clear() {
    commits.value = []
    branchFilter.value = null
  }

  function resetFilter() {
    branchFilter.value = null
  }

  return { commits, loading, maxCount, branchFilter, fetchGraph, fetchGraphForCurrent, resetFilter, clear }
})

function assignMultiColumns(
  hashes: string[],
  parentMap: Map<string, string[]>,
  hashToIndex: Map<string, number>,
): Map<string, number> {
  const n = hashes.length
  const columnMap = new Map<string, number>()
  const active: (string | null)[] = [hashes[0]]

  for (let i = 0; i < n; i++) {
    const hash = hashes[i]
    const parents = parentMap.get(hash) || []

    let col: number
    const activeIdx = active.indexOf(hash)

    if (activeIdx !== -1) {
      col = activeIdx
      active[col] = null
    } else {
      const freeIdx = active.indexOf(null)
      if (freeIdx !== -1) {
        col = freeIdx
      } else {
        col = active.length
        active.push(null)
      }
    }

    columnMap.set(hash, col)

    if (parents.length > 0) {
      const newActive = [...active]
      if (newActive[col] === null) {
        newActive[col] = parents[0]
      } else {
        const freeIdx = newActive.indexOf(null)
        if (freeIdx !== -1) {
          newActive[freeIdx] = parents[0]
        } else {
          newActive.push(parents[0])
        }
      }

      for (let p = 1; p < parents.length; p++) {
        const freeIdx = newActive.indexOf(null)
        if (freeIdx !== -1) {
          newActive[freeIdx] = parents[p]
        } else {
          newActive.push(parents[p])
        }
      }

      active.length = 0
      active.push(...newActive)
    }
  }

  return compressColumns(columnMap, hashes, hashToIndex, parentMap)
}

function compressColumns(
  columnMap: Map<string, number>,
  hashes: string[],
  hashToIndex: Map<string, number>,
  parentMap: Map<string, string[]>,
): Map<string, number> {
  const result = new Map(columnMap)
  const sorted = [...hashes].sort((a, b) => hashToIndex.get(a)! - hashToIndex.get(b)!)
  const n = hashes.length

  const allCols = [...new Set([...result.values()])].sort((a, b) => a - b)
  if (allCols.length <= 1) return result

  const getPipe = (cm: Map<string, number>, col: number): Array<[number, number]> => {
    const rows = sorted.filter(h => cm.get(h) === col).map(h => hashToIndex.get(h)!).sort((a, b) => a - b)
    if (rows.length === 0) return []
    const pipes: Array<[number, number]> = []
    for (let i = 0; i < rows.length - 1; i++) {
      pipes.push([rows[i], rows[i + 1]])
    }
    return pipes
  }

  const intersects = (a: Array<[number, number]>, b: Array<[number, number]>): boolean => {
    for (const [a1, a2] of a) {
      for (const [b1, b2] of b) {
        if (a2 > b1 && a1 < b2) return true
      }
    }
    return false
  }

  let changed = true
  while (changed) {
    changed = false

    const colsNow = [...new Set([...result.values()])].sort((a, b) => a - b)
    if (colsNow.length <= 1) break

    for (let c = colsNow.length - 1; c >= 1; c--) {
      const curCol = colsNow[c]
      const leftCol = colsNow[c - 1]

      const curNodes = sorted.filter(h => result.get(h) === curCol)
      if (curNodes.length === 0) continue

      const curRows = curNodes.map(h => hashToIndex.get(h)!).sort((a, b) => a - b)
      const leftPipes = getPipe(result, leftCol)

      const groups: Array<{ nodes: string[]; rows: number[] }> = []
      let groupNodes: string[] = [curNodes.find(h => hashToIndex.get(h) === curRows[0])!]
      let groupRows: number[] = [curRows[0]]

      for (let i = 1; i < curRows.length; i++) {
        const gap = [curRows[i - 1], curRows[i]]
        if (!intersects(leftPipes, [gap])) {
          groupNodes.push(curNodes.find(h => hashToIndex.get(h) === curRows[i])!)
          groupRows.push(curRows[i])
        } else {
          groups.push({ nodes: groupNodes, rows: groupRows })
          groupNodes = [curNodes.find(h => hashToIndex.get(h) === curRows[i])!]
          groupRows = [curRows[i]]
        }
      }
      groups.push({ nodes: groupNodes, rows: groupRows })

      for (const group of groups) {
        const rowSet = new Set(group.rows)
        const connectedLeft: Array<[number, number]> = []

        for (const node of group.nodes) {
          const row = hashToIndex.get(node)!
          const parents = parentMap.get(node) || []
          for (const p of parents) {
            const pRow = hashToIndex.get(p)
            if (pRow !== undefined && !rowSet.has(pRow)) {
              connectedLeft.push([Math.min(row, pRow), Math.max(row, pRow)])
            }
          }
        }

        const newCurPipes = getPipe(result, curCol).filter(p => !group.rows.includes(p[0]) && !group.rows.includes(p[1]))
        const newLeftPipes = [...leftPipes]

        let canMove = true
        for (const seg of connectedLeft) {
          if (intersects(newLeftPipes, [seg])) canMove = false
        }
        for (const seg of connectedLeft) {
          if (intersects(newCurPipes, [seg])) canMove = false
        }

        if (canMove) {
          for (const node of group.nodes) {
            result.set(node, leftCol)
          }
          changed = true
          break
        }
      }

      if (changed) break
    }
  }

  const colOrder: number[] = []
  for (const h of sorted) {
    const col = result.get(h)!
    if (!colOrder.includes(col)) colOrder.push(col)
  }

  const colRemap = new Map<number, number>()
  for (let i = 0; i < colOrder.length; i++) {
    colRemap.set(colOrder[i], i)
  }

  const finalResult = new Map<string, number>()
  for (const [h, col] of result) {
    finalResult.set(h, colRemap.get(col) ?? col)
  }

  return finalResult
}

function parseGraphOutput(raw: string): GraphCommit[] {
  const lines = raw.split('\n').filter(l => l.trim())
  const result: GraphCommit[] = []

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

  const hashToIndex = new Map<string, number>()
  for (let i = 0; i < hashes.length; i++) {
    hashToIndex.set(hashes[i], i)
  }

  const columnMap = assignMultiColumns(hashes, parentHashesMap, hashToIndex)

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
