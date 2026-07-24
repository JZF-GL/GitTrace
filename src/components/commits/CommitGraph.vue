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

function showContextMenu(e: MouseEvent, commit: GraphCommit) {
  e.preventDefault()
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

const columnWidth = 20
const rowHeight = 40
const nodeRadius = 5
const graphLeftPad = 8

const graphWidth = computed(() => {
  const maxCol = Math.max(...props.commits.map(c => c.column), 0)
  return (maxCol + 1) * columnWidth + graphLeftPad
})

const graphHeight = computed(() => props.commits.length * rowHeight)

function getX(col: number) {
  return col * columnWidth + graphLeftPad + nodeRadius
}

function getY(index: number) {
  return index * rowHeight + rowHeight / 2
}

function getLineColor(col: number): string {
  const colors = ['#58a6ff', '#3fb950', '#bc8cff', '#d29922', '#f85149', '#39d353', '#f778ba', '#79c0ff', '#56d364', '#d2a8ff']
  return colors[col % colors.length]
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

const allLines = computed(() => {
  const lines: { x1: number; y1: number; x2: number; y2: number; color: string }[] = []
  const hashIndex = new Map<string, number>()
  props.commits.forEach((c, i) => hashIndex.set(c.hash, i))

  for (let i = 0; i < props.commits.length; i++) {
    const commit = props.commits[i]
    for (const parentHash of commit.parentHashes) {
      const parentIndex = hashIndex.get(parentHash)
      if (parentIndex !== undefined) {
        lines.push({
          x1: getX(commit.column),
          y1: getY(i),
          x2: getX(props.commits[parentIndex].column),
          y2: getY(parentIndex),
          color: getLineColor(commit.column),
        })
      }
    }
  }
  return lines
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
  <div class="commit-graph-wrapper">
    <!-- Single SVG overlay for all graph lines and nodes -->
    <svg
      class="graph-overlay"
      :width="graphWidth"
      :height="graphHeight"
    >
      <!-- Connection lines -->
      <line
        v-for="(line, li) in allLines"
        :key="'line-' + li"
        :x1="line.x1"
        :y1="line.y1"
        :x2="line.x2"
        :y2="line.y2"
        :stroke="line.color"
        stroke-width="2"
        stroke-opacity="0.5"
      />

      <!-- Commit nodes -->
      <template v-for="(commit, index) in commits" :key="'node-' + commit.hash">
        <circle
          :cx="getX(commit.column)"
          :cy="getY(index)"
          :r="nodeRadius"
          :fill="getLineColor(commit.column)"
          :stroke="selectedHash === commit.hash ? '#ffffff' : 'transparent'"
          stroke-width="2"
        />
      </template>
    </svg>

    <!-- Commit rows (text content) -->
    <div class="commit-rows">
      <div
        v-for="(commit, index) in commits"
        :key="commit.hash"
        class="commit-row"
        :class="{ selected: selectedHash === commit.hash }"
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
        <div class="context-menu-item danger" @click="handleReset">
          回退到此提交
        </div>
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
  display: flex;
}

.graph-overlay {
  flex-shrink: 0;
  pointer-events: none;
}

.commit-rows {
  flex: 1;
  min-width: 0;
}

.commit-row {
  display: flex;
  align-items: center;
  cursor: pointer;
  transition: background 0.1s;
  height: 40px;
}

.commit-row:hover {
  background: var(--bg-hover);
}

.commit-row.selected {
  background: rgba(88, 166, 255, 0.15);
}

.commit-info {
  flex: 1;
  padding: 0 12px 0 8px;
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
