<script setup lang="ts">
import { computed } from 'vue'
import { format } from 'date-fns'
import type { GraphCommit } from '../../stores/commits'

const props = defineProps<{
  commits: GraphCommit[]
  selectedHash?: string
}>()

const emit = defineEmits<{
  (e: 'select', commit: GraphCommit): void
}>()

const columnWidth = 24
const rowHeight = 40
const nodeRadius = 5
const graphLeftPad = 12

const graphWidth = computed(() => {
  const maxCol = Math.max(...props.commits.map(c => c.column), 0)
  return (maxCol + 1) * columnWidth + graphLeftPad * 2
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
      :viewBox="`0 0 ${graphWidth} ${graphHeight}`"
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
        @click="emit('select', commit)"
      >
        <div class="commit-info">
          <div class="commit-message">{{ commit.message }}</div>
          <div class="commit-meta">
            <span class="commit-hash">{{ commit.shortHash }}</span>
            <span class="commit-author">{{ commit.author }}</span>
            <span class="commit-date">{{ formatDate(commit.date) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.commit-graph-wrapper {
  position: relative;
}

.graph-overlay {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
  pointer-events: none;
}

.commit-rows {
  position: relative;
  z-index: 2;
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
</style>
