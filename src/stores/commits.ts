import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface LaneConnection {
  fromCol: number
  toCol: number
  color: number
}

export interface ActiveLane {
  col: number
  color: number
}

export interface GraphCommit {
  hash: string
  shortHash: string
  parentHashes: string[]
  author: string
  date: string
  message: string
  column: number
  color: number
  isMerge: boolean
  branch: string[]
  pushed?: boolean
  refs?: string
  hasIncoming?: boolean
  hasOutgoing?: boolean
  activeLanes?: ActiveLane[]
  connections?: LaneConnection[]
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
        if (commit.hash) {
          commit.pushed = remoteHashSet.has(commit.hash)
        }
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
    const lines = raw.split('\n')
    const rawCommits: Array<{
      hash: string
      shortHash: string
      parents: string[]
      author: string
      date: string
      message: string
      refs: string
    }> = []

    for (const line of lines) {
      if (!line.trim()) continue

      if (line.includes('__GT_COMMIT__')) {
        const sepIdx = line.indexOf('__GT_COMMIT__')
        const dataPart = line.substring(sepIdx + '__GT_COMMIT__'.length)
        const parts = dataPart.split('__GT_SEP__')

        if (parts.length >= 6) {
          const hash = parts[1]
          if (!hash) continue
          const parents = parts[2] ? parts[2].trim().split(/\s+/).filter(Boolean) : []
          rawCommits.push({
            hash,
            shortHash: parts[3] || hash.substring(0, 7),
            parents,
            author: parts[4] || '',
            date: parts[5] || '',
            message: parts.slice(6).join('__GT_SEP__'),
            refs: (parts[0] || '').trim(),
          })
        }
      } else {
        const match = line.match(/^(.*)\|(.*)\|(.*)\|(.*)\|(.*)\|(.*)\|(.*)$/)
        if (match) {
          const [, refs, hash, parentsStr, shortHash, author, date, message] = match
          if (hash) {
            rawCommits.push({
              hash,
              shortHash: shortHash || hash.substring(0, 7),
              parents: parentsStr ? parentsStr.trim().split(/\s+/).filter(Boolean) : [],
              author: author || '',
              date: date || '',
              message: message || '',
              refs: (refs || '').trim(),
            })
          }
        }
      }
    }

    // 运行拓扑泳道状态机算法
    const lanes: (string | null)[] = []
    const laneColors: number[] = []
    let nextColor = 0

    const result: GraphCommit[] = []

    for (let r = 0; r < rawCommits.length; r++) {
      const commit = rawCommits[r]

      // 1. 查找当前 commit 所在的泳道
      let col = lanes.indexOf(commit.hash)
      const hasIncoming = col !== -1

      if (col === -1) {
        col = lanes.indexOf(null)
        if (col === -1) {
          col = lanes.length
          lanes.push(commit.hash)
          laneColors.push(nextColor++)
        } else {
          lanes[col] = commit.hash
          laneColors[col] = nextColor++
        }
      }

      const commitCol = col
      const commitColor = laneColors[commitCol]

      // 记录进入该行时所有的活跃泳道（非 null）
      const activeLanes: ActiveLane[] = []
      for (let i = 0; i < lanes.length; i++) {
        if (lanes[i] !== null) {
          activeLanes.push({ col: i, color: laneColors[i] })
        }
      }

      // 2. 更新泳道目标：commit 被其父提交替换
      const parents = commit.parents
      const connections: LaneConnection[] = []

      if (parents.length === 0) {
        lanes[commitCol] = null
      } else {
        // 第一父提交接管当前泳道
        lanes[commitCol] = parents[0]

        // 其他父提交（Merge 来源）分配或并入其他泳道
        for (let pIdx = 1; pIdx < parents.length; pIdx++) {
          const pHash = parents[pIdx]
          let pCol = lanes.indexOf(pHash)
          if (pCol === -1) {
            pCol = lanes.indexOf(null)
            if (pCol === -1) {
              pCol = lanes.length
              lanes.push(pHash)
              laneColors.push(nextColor++)
            } else {
              lanes[pCol] = pHash
              laneColors[pCol] = nextColor++
            }
          }
          connections.push({ fromCol: commitCol, toCol: pCol, color: laneColors[pCol] })
        }
      }

      // 3. 检查是否有多个泳道等待同一个父提交（合流并入）
      for (let i = 0; i < lanes.length; i++) {
        if (lanes[i] === null) continue
        for (let j = i + 1; j < lanes.length; j++) {
          if (lanes[i] === lanes[j]) {
            connections.push({ fromCol: j, toCol: i, color: laneColors[j] })
            lanes[j] = null
          }
        }
      }

      // 清理尾部空闲 null
      while (lanes.length > 0 && lanes[lanes.length - 1] === null) {
        lanes.pop()
        laneColors.pop()
      }

      result.push({
        hash: commit.hash,
        shortHash: commit.shortHash,
        parentHashes: commit.parents,
        author: commit.author,
        date: commit.date,
        message: commit.message,
        column: commitCol,
        color: commitColor,
        isMerge: commit.parents.length > 1,
        branch: [],
        refs: commit.refs,
        hasIncoming,
        hasOutgoing: parents.length > 0,
        activeLanes,
        connections,
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
