<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { format } from 'date-fns'
import { useMessage, useDialog } from 'naive-ui'
import { useRepositoryStore } from '../../stores/repository'
import { useBranchesStore } from '../../stores/branches'
import { useCommitsStore } from '../../stores/commits'
import { useStagingStore } from '../../stores/staging'
import type { GraphCommit } from '../../stores/commits'

const props = defineProps<{
  commits: GraphCommit[]
  selectedHash?: string
}>()

const emit = defineEmits<{
  (e: 'select', commit: GraphCommit): void
}>()

const repoStore = useRepositoryStore()
const branchesStore = useBranchesStore()
const commitsStore = useCommitsStore()
const stagingStore = useStagingStore()
const message = useMessage()
const dialog = useDialog()

const repo = computed(() => repoStore.currentRepo)

// 用于模板中访问 window
const window = globalThis.window

// Context menu state
const contextMenu = ref({
  show: false,
  x: 0,
  y: 0,
  commit: null as GraphCommit | null,
})
const contextMenuCommitOnBranch = ref(true)

// Hover tooltip state
const hoverTooltip = ref({
  show: false,
  x: 0,
  y: 0,
  commit: null as GraphCommit | null,
  stat: null as { message: string; filesChanged: number; insertions: number; deletions: number } | null,
  loading: false,
})

const hoverDisabled = ref(false)
let hoverTimeout: ReturnType<typeof setTimeout> | null = null

async function showHoverTooltip(e: MouseEvent, commit: GraphCommit) {
  // 如果被点击禁用，不显示
  if (hoverDisabled.value) return
  if (contextMenu.value.show) return

  // 清除之前的定时器
  if (hoverTimeout) {
    clearTimeout(hoverTimeout)
  }

  // 延迟显示，避免快速移动时频繁触发
  hoverTimeout = setTimeout(async () => {
    hoverTooltip.value = {
      show: true,
      x: e.clientX,
      y: e.clientY,
      commit,
      stat: null,
      loading: true,
    }

    // 获取提交统计信息
    if (repo.value) {
      try {
        const stat = await window.electronAPI.git.commitStat(repo.value.path, commit.hash)
        hoverTooltip.value.stat = stat
      } catch {
        hoverTooltip.value.stat = null
      }
    }
    hoverTooltip.value.loading = false
  }, 300)
}

function updateHoverPosition(e: MouseEvent) {
  if (hoverTooltip.value.show && !hoverDisabled.value) {
    hoverTooltip.value.x = e.clientX
    hoverTooltip.value.y = e.clientY
  }
}

function hideHoverTooltip() {
  if (hoverTimeout) {
    clearTimeout(hoverTimeout)
    hoverTimeout = null
  }
  hoverTooltip.value.show = false
}

function disableHover() {
  hoverDisabled.value = true
  hideHoverTooltip()
}

function enableHover() {
  hoverDisabled.value = false
}

async function showContextMenu(e: MouseEvent, commit: GraphCommit) {
  e.preventDefault()
  // 只有筛选"当前分支"时才允许回退操作
  contextMenuCommitOnBranch.value = commitsStore.branchFilter === null

  contextMenu.value = {
    show: true,
    x: e.clientX,
    y: e.clientY,
    commit,
  }
}

function hideContextMenu() {
  contextMenu.value.show = false
}

onMounted(() => {
  document.addEventListener('click', hideContextMenu)
})

onUnmounted(() => {
  document.removeEventListener('click', hideContextMenu)
})

async function handleCherryPick() {
  const commit = contextMenu.value.commit
  if (!commit || !repo.value) return
  hideContextMenu()

  dialog.warning({
    title: '挑选提交',
    content: `确定要将提交 ${commit.shortHash} 挑选到当前分支吗？`,
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        const result = await window.electronAPI.git.cherryPick(repo.value!.path, commit.hash)
        if (result?.success) {
          message.success('挑选成功')
          await Promise.all([
            commitsStore.fetchGraphForCurrent(repo.value!.path, branchesStore.current),
            stagingStore.fetchStatus(repo.value!.path),
          ])
        } else if (result?.conflict) {
          message.warning('挑选有冲突，请在工作区解决')
          stagingStore.commitMessage = `cherry-pick ${commit.shortHash}`
          await stagingStore.fetchStatus(repo.value!.path)
        } else {
          message.error('挑选失败: ' + (result?.message || '未知错误'))
        }
      } catch (e: any) {
        message.error('挑选失败: ' + (e.message || String(e)))
      }
    },
  })
}

async function handleReset() {
  const commit = contextMenu.value.commit
  if (!commit || !repo.value) return
  hideContextMenu()

  dialog.warning({
    title: '回退到此提交',
    content: `确定要回退到提交 ${commit.shortHash} 吗？此操作会丢失之后的提交。`,
    positiveText: '确定回退',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        const result = await window.electronAPI.git.resetCommit(repo.value!.path, commit.hash, 'hard')
        if (result?.success) {
          message.success('已回退到 ' + commit.shortHash)
          await Promise.all([
            branchesStore.fetchBranches(repo.value!.path),
            commitsStore.fetchGraphForCurrent(repo.value!.path, branchesStore.current),
            stagingStore.fetchStatus(repo.value!.path),
          ])
        } else {
          message.error('回退失败: ' + (result?.message || '未知错误'))
        }
      } catch (e: any) {
        message.error('回退失败: ' + (e.message || String(e)))
      }
    },
  })
}

async function handleSoftReset() {
  const commit = contextMenu.value.commit
  if (!commit || !repo.value) return
  hideContextMenu()

  dialog.warning({
    title: 'Soft Reset',
    content: `确定要回退到提交 ${commit.shortHash} 吗？更改将保留在暂存区。`,
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        const result = await window.electronAPI.git.resetCommit(repo.value!.path, commit.hash, 'soft')
        if (result?.success) {
          stagingStore.commitMessage = commit.message
          message.success('已回退到 ' + commit.shortHash)
          await Promise.all([
            branchesStore.fetchBranches(repo.value!.path),
            commitsStore.fetchGraphForCurrent(repo.value!.path, branchesStore.current),
            stagingStore.fetchStatus(repo.value!.path),
          ])
        } else {
          message.error('回退失败: ' + (result?.message || '未知错误'))
        }
      } catch (e: any) {
        message.error('回退失败: ' + (e.message || String(e)))
      }
    },
  })
}

async function handleMixedReset() {
  const commit = contextMenu.value.commit
  if (!commit || !repo.value) return
  hideContextMenu()

  dialog.warning({
    title: 'Mixed Reset',
    content: `确定要回退到提交 ${commit.shortHash} 吗？更改将保留在工作区。`,
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        const result = await window.electronAPI.git.resetCommit(repo.value!.path, commit.hash, 'mixed')
        if (result?.success) {
          stagingStore.commitMessage = commit.message
          message.success('已回退到 ' + commit.shortHash)
          await Promise.all([
            branchesStore.fetchBranches(repo.value!.path),
            commitsStore.fetchGraphForCurrent(repo.value!.path, branchesStore.current),
            stagingStore.fetchStatus(repo.value!.path),
          ])
        } else {
          message.error('回退失败: ' + (result?.message || '未知错误'))
        }
      } catch (e: any) {
        message.error('回退失败: ' + (e.message || String(e)))
      }
    },
  })
}

async function handleUndoLastCommit(mode: 'soft' | 'mixed') {
  const commit = contextMenu.value.commit
  if (!commit || !repo.value) return
  hideContextMenu()

  const title = mode === 'soft' ? '回退最近提交到暂存区' : '回退最近提交到工作区'
  const content = mode === 'soft'
    ? '确定要回退最近一次提交吗？更改将保留在暂存区。'
    : '确定要回退最近一次提交吗？更改将保留在工作区。'

  dialog.warning({
    title,
    content,
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        const result = await window.electronAPI.git.resetCommit(repo.value!.path, 'HEAD~1', mode)
        if (result?.success) {
          stagingStore.commitMessage = commit.message
          message.success('已回退最近一次提交')
          await Promise.all([
            branchesStore.fetchBranches(repo.value!.path),
            commitsStore.fetchGraphForCurrent(repo.value!.path, branchesStore.current),
            stagingStore.fetchStatus(repo.value!.path),
          ])
        } else {
          message.error('回退失败: ' + (result?.message || '未知错误'))
        }
      } catch (e: any) {
        message.error('回退失败: ' + (e.message || String(e)))
      }
    },
  })
}

const columnWidth = 20
const rowHeight = 40
const nodeRadius = 5
const graphLeftPad = 8

const graphHeight = computed(() => props.commits.length * rowHeight)

const graphWidth = computed(() => {
  let maxCol = 0
  for (const c of props.commits) {
    maxCol = Math.max(maxCol, c.column || 0)
    if (c.activeLanes) {
      for (const lane of c.activeLanes) {
        maxCol = Math.max(maxCol, lane.col)
      }
    }
    if (c.connections) {
      for (const conn of c.connections) {
        maxCol = Math.max(maxCol, conn.fromCol, conn.toCol)
      }
    }
  }
  return (maxCol + 1) * columnWidth + graphLeftPad + 12
})

function getX(col: number) {
  return col * columnWidth + graphLeftPad + nodeRadius
}

function getY(row: number) {
  return row * rowHeight + rowHeight / 2
}

function getRowMaxCol(commit: GraphCommit): number {
  let maxCol = commit.column ?? 0
  if (commit.activeLanes) {
    for (const lane of commit.activeLanes) {
      if (lane.col > maxCol) {
        maxCol = lane.col
      }
    }
  }
  if (commit.connections) {
    for (const conn of commit.connections) {
      if (conn.fromCol > maxCol) maxCol = conn.fromCol
      if (conn.toCol > maxCol) maxCol = conn.toCol
    }
  }
  return maxCol
}

function getRowIndent(commit: GraphCommit): number {
  const maxCol = getRowMaxCol(commit)
  return (maxCol + 1) * columnWidth + graphLeftPad + 2
}

function getLineColor(colOrColor: number): string {
  const colors = ['#58a6ff', '#3fb950', '#bc8cff', '#d29922', '#f85149', '#39d353', '#f778ba', '#79c0ff', '#56d364', '#d2a8ff']
  return colors[Math.abs(colOrColor) % colors.length]
}

function parseRefs(refs: string): string[] {
  if (!refs) return []
  return refs.split(',').map(r => r.trim()).filter(r => r)
}

function getRefClass(ref: string): string {
  if (ref.includes('HEAD')) return 'ref-head'
  if (ref.includes('tag:')) return 'ref-tag'
  if (ref.includes('origin/')) return 'ref-remote'
  return 'ref-local'
}

function isLatestCommit(commit: GraphCommit | null): boolean {
  if (!commit || props.commits.length === 0) return false
  return props.commits[0].hash === commit.hash
}

interface GraphNode {
  key: string
  cx: number
  cy: number
  color: string
  selected: boolean
}

const graphData = computed(() => {
  const paths: { d: string; color: string }[] = []
  const nodes: GraphNode[] = []

  for (let r = 0; r < props.commits.length; r++) {
    const commit = props.commits[r]
    const yTop = r * rowHeight
    const yBottom = yTop + rowHeight
    const yMid = yTop + rowHeight / 2

    // 1. 穿过当前行的垂直线 (Active Lanes)
    const activeLanes = commit.activeLanes && commit.activeLanes.length > 0
      ? commit.activeLanes
      : [{ col: commit.column, color: commit.color ?? commit.column }]

    for (const lane of activeLanes) {
      const cx = getX(lane.col)
      const color = getLineColor(lane.color)

      if (lane.col === commit.column) {
        // 当前节点所在列：根据有无向上进线、向下出线精准画线，杜绝上下多余的线段
        if (commit.hasIncoming !== false) {
          paths.push({
            d: `M ${cx} ${yTop} L ${cx} ${yMid}`,
            color,
          })
        }
        if (commit.hasOutgoing !== false) {
          paths.push({
            d: `M ${cx} ${yMid} L ${cx} ${yBottom}`,
            color,
          })
        }
      } else {
        // 其它泳道：检查是否在当前行被合并汇入了节点
        const isMergedHere = commit.connections?.some(
          conn => conn.fromCol === lane.col && conn.fromCol > conn.toCol
        )
        if (!isMergedHere) {
          // 未在此处合并，正常垂直贯穿整行
          paths.push({
            d: `M ${cx} ${yTop} L ${cx} ${yBottom}`,
            color,
          })
        }
      }
    }

    // 2. 当前行的分叉与合并连接线 (Connections)
    if (commit.connections) {
      const R = columnWidth / 2
      for (const conn of commit.connections) {
        const xFrom = getX(conn.fromCol)
        const xTo = getX(conn.toCol)
        const color = getLineColor(conn.color)

        if (conn.fromCol < conn.toCol) {
          // 向右分叉：从当前节点中心横向出，拐弯处带圆弧，随后垂直入目标列底部
          paths.push({
            d: `M ${xFrom} ${yMid} L ${xTo - R} ${yMid} A ${R} ${R} 0 0 1 ${xTo} ${yMid + R} L ${xTo} ${yBottom}`,
            color,
          })
        } else if (conn.fromCol > conn.toCol) {
          // 向左合流：从外层列顶部垂直向下，拐弯处带圆弧，随后横向入当前节点中心
          paths.push({
            d: `M ${xFrom} ${yTop} L ${xFrom} ${yMid - R} A ${R} ${R} 0 0 1 ${xFrom - R} ${yMid} L ${xTo} ${yMid}`,
            color,
          })
        }
      }
    }

    // 3. 当前提交节点 (Commit Node)
    const nodeX = getX(commit.column)
    nodes.push({
      key: commit.hash || `node-${r}`,
      cx: nodeX,
      cy: yMid,
      color: getLineColor(commit.color ?? commit.column),
      selected: props.selectedHash === commit.hash,
    })
  }

  return { paths, nodes }
})

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return format(d, 'MM-dd HH:mm')
  } catch {
    return dateStr
  }
}
</script>

<template>
  <div
    class="commit-graph-wrapper"
    :style="{ minWidth: graphWidth ? graphWidth + 'px' : '100%' }"
  >
    <!-- Single SVG overlay for all graph lines and nodes -->
    <svg
      class="graph-overlay"
      :width="graphWidth"
      :height="graphHeight"
    >
      <!-- Connection paths -->
      <path
        v-for="(path, pi) in graphData.paths"
        :key="'path-' + pi"
        :d="path.d"
        :stroke="path.color"
        stroke-width="2"
        stroke-opacity="0.8"
        fill="none"
        stroke-linecap="round"
        stroke-linejoin="round"
      />

      <!-- Commit nodes -->
      <circle
        v-for="node in graphData.nodes"
        :key="node.key"
        :cx="node.cx"
        :cy="node.cy"
        :r="nodeRadius"
        :fill="node.color"
        :stroke="node.selected ? '#ffffff' : 'transparent'"
        stroke-width="2"
      />
    </svg>

    <!-- Commit rows (text content) -->
    <div class="commit-rows">
      <div
        v-for="(commit, index) in commits"
        :key="commit.hash"
        class="commit-row"
        :class="{ selected: selectedHash === commit.hash }"
        :style="{ paddingLeft: getRowIndent(commit) + 'px' }"
        @click="disableHover(); emit('select', commit)"
        @contextmenu="disableHover(); showContextMenu($event, commit)"
        @mouseenter="enableHover(); showHoverTooltip($event, commit)"
        @mousemove="updateHoverPosition($event)"
        @mouseleave="hideHoverTooltip()"
      >
        <div class="commit-info">
          <div class="commit-message">
            <span v-if="commit.pushed === true" class="push-status pushed" title="已推送">&#10003;</span>
            <span v-else-if="commit.pushed === false" class="push-status unpushed" title="未推送">&#8644;</span>
            {{ commit.message }}
            <template v-if="commit.refs">
              <span v-for="ref in parseRefs(commit.refs)" :key="ref" class="branch-tag" :class="getRefClass(ref)">
                {{ ref.replace('HEAD -> ', '').replace('tag: ', '') }}
              </span>
            </template>
          </div>
          <div class="commit-meta">
            <span class="commit-hash">{{ commit.shortHash }}</span>
            <span class="commit-author">{{ commit.author }}</span>
            <span class="commit-date">{{ formatDate(commit.date) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Context menu -->
    <Teleport to="body">
      <div
        v-if="contextMenu.show"
        class="commit-context-menu"
        :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
      >
        <div class="context-menu-item" @click="handleCherryPick">
          挑选提交
        </div>
        <!-- 只有当前分支的提交才显示回退/Reset操作 -->
        <template v-if="contextMenuCommitOnBranch">
          <!-- 只有最新提交显示回退最近提交 -->
          <template v-if="isLatestCommit(contextMenu.commit)">
            <div class="context-menu-divider"></div>
            <div class="context-menu-item" @click="handleUndoLastCommit('soft')">
              回退最近提交到暂存区
            </div>
            <div class="context-menu-item" @click="handleUndoLastCommit('mixed')">
              回退最近提交到工作区
            </div>
          </template>
          <!-- 只有非最新提交显示 Soft/Mixed Reset -->
          <template v-if="!isLatestCommit(contextMenu.commit)">
            <div class="context-menu-divider"></div>
            <div class="context-menu-item" @click="handleSoftReset">
              Soft Reset（保留暂存）
            </div>
            <div class="context-menu-item" @click="handleMixedReset">
              Mixed Reset（保留工作区）
            </div>
          </template>
          <div class="context-menu-divider"></div>
          <div class="context-menu-item danger" @click="handleReset">
            回退到此提交（Hard Reset）
          </div>
        </template>
      </div>
    </Teleport>

    <!-- Hover tooltip -->
    <Teleport to="body">
      <div
        v-if="hoverTooltip.show && hoverTooltip.commit"
        class="commit-hover-tooltip"
        :style="{
          left: Math.min(hoverTooltip.x + 20, window.innerWidth - 380) + 'px',
          top: Math.min(hoverTooltip.y - 10, window.innerHeight - 200) + 'px'
        }"
      >
        <div class="tooltip-message">{{ hoverTooltip.commit.message }}</div>
        <div v-if="hoverTooltip.commit.refs" class="tooltip-refs">
          <span v-for="ref in parseRefs(hoverTooltip.commit.refs)" :key="ref" class="branch-tag" :class="getRefClass(ref)">
            {{ ref.replace('HEAD -> ', '').replace('tag: ', '') }}
          </span>
        </div>
        <div class="tooltip-info">
          <span class="tooltip-hash">{{ hoverTooltip.commit.shortHash }}</span>
          <span class="tooltip-author">{{ hoverTooltip.commit.author }}</span>
          <span class="tooltip-date">{{ formatDate(hoverTooltip.commit.date) }}</span>
        </div>
        <div v-if="hoverTooltip.loading" class="tooltip-loading">加载中...</div>
        <div v-else-if="hoverTooltip.stat" class="tooltip-stat">
          <span class="stat-files">{{ hoverTooltip.stat.filesChanged }} 个文件变更</span>
          <span v-if="hoverTooltip.stat.insertions > 0" class="stat-add">+{{ hoverTooltip.stat.insertions }}</span>
          <span v-if="hoverTooltip.stat.deletions > 0" class="stat-del">-{{ hoverTooltip.stat.deletions }}</span>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.commit-graph-wrapper {
  position: relative;
  width: 100%;
}

.graph-overlay {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  z-index: 1;
}

.commit-rows {
  width: 100%;
}

.commit-row {
  display: flex;
  align-items: center;
  cursor: pointer;
  transition: background 0.1s;
  height: 40px;
  box-sizing: border-box;
}

.commit-row:hover {
  background: var(--bg-hover);
}

.commit-row.selected {
  background: rgba(88, 166, 255, 0.15);
}

.commit-info {
  flex: 1;
  padding: 0 12px 0 0;
  min-width: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1px;
}

.commit-message {
  font-size: 13px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.3;
}

.commit-meta {
  display: flex;
  align-items: center;
  gap: 6px;
}

.commit-hash {
  font-family: 'Cascadia Code', 'Fira Code', 'SF Mono', 'Menlo', 'Monaco', monospace;
  font-size: 11px;
  color: var(--accent-blue);
  font-weight: 600;
  flex-shrink: 0;
}

.commit-author {
  font-size: 11px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.commit-date {
  font-size: 11px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.push-status {
  font-size: 10px;
  margin-right: 4px;
  font-weight: bold;
}

.push-status.pushed {
  color: var(--accent-green);
}

.push-status.unpushed {
  color: var(--accent-orange);
}

.commit-context-menu {
  position: fixed;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 4px 0;
  min-width: 160px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
}

.context-menu-item {
  padding: 8px 12px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-primary);
  transition: background 0.1s;
}

.context-menu-item:hover {
  background: var(--bg-hover);
}

.context-menu-item.danger {
  color: var(--accent-red);
}

.context-menu-item.danger:hover {
  background: rgba(248, 81, 73, 0.15);
}

.context-menu-divider {
  height: 1px;
  background: var(--border-color);
  margin: 4px 0;
}

.branch-tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  margin-left: 6px;
  font-weight: 500;
  white-space: nowrap;
}

.ref-head {
  background: rgba(88, 166, 255, 0.2);
  color: var(--accent-blue);
}

.ref-local {
  background: rgba(63, 185, 80, 0.2);
  color: var(--accent-green);
}

.ref-remote {
  background: rgba(188, 140, 255, 0.2);
  color: var(--accent-purple);
}

.ref-tag {
  background: rgba(210, 153, 34, 0.2);
  color: var(--accent-orange);
}

.commit-hover-tooltip {
  position: fixed;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px;
  min-width: 350px;
  max-width: 400px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  z-index: 1001;
  pointer-events: none;
}

.tooltip-message {
  font-size: 13px;
  color: var(--text-primary);
  word-break: break-word;
  line-height: 1.5;
  margin-bottom: 8px;
}

.tooltip-refs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}

.tooltip-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 8px;
}

.tooltip-hash {
  font-family: monospace;
  color: var(--accent-blue);
  font-weight: 600;
}

.tooltip-loading {
  font-size: 11px;
  color: var(--text-muted);
}

.tooltip-stat {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-family: monospace;
}

.stat-files {
  color: var(--text-secondary);
}

.stat-add {
  color: var(--accent-green);
}

.stat-del {
  color: var(--accent-red);
}
</style>
