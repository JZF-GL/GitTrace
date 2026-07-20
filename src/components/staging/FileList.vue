<script setup lang="ts">
import type { FileChange } from '../../stores/staging'

defineProps<{
  files: FileChange[]
  selectedFiles: Set<string>
  selectedFile: string | null
}>()

const emit = defineEmits<{
  (e: 'select', path: string): void
  (e: 'toggle-select', path: string): void
}>()

function getStatusClass(file: FileChange): string {
  if (file.index === '?' && file.workingDir === '?') return 'status-untracked'
  if (file.index === 'A' || file.workingDir === 'A') return 'status-added'
  if (file.index === 'D' || file.workingDir === 'D') return 'status-deleted'
  if (file.index === 'R' || file.workingDir === 'R') return 'status-renamed'
  return 'status-modified'
}

function getStatusSymbol(file: FileChange): string {
  if (file.index === '?' && file.workingDir === '?') return '?'
  if (file.index === 'A' || file.workingDir === 'A') return 'A'
  if (file.index === 'D' || file.workingDir === 'D') return 'D'
  if (file.index === 'R' || file.workingDir === 'R') return 'R'
  return 'M'
}

function getShortPath(path: string): string {
  const parts = path.split('/')
  if (parts.length <= 2) return path
  return '...' + parts.slice(-2).join('/')
}
</script>

<template>
  <div class="file-list">
    <div
      v-for="file in files"
      :key="file.path"
      class="file-item"
      :class="{
        selected: selectedFile === file.path,
        checked: selectedFiles.has(file.path),
      }"
      @click="emit('select', file.path)"
    >
      <input
        type="checkbox"
        :checked="selectedFiles.has(file.path)"
        @click.stop="emit('toggle-select', file.path)"
        class="file-checkbox"
      />
      <span class="file-status" :class="getStatusClass(file)">
        {{ getStatusSymbol(file) }}
      </span>
      <span class="file-path" :title="file.path">{{ getShortPath(file.path) }}</span>
    </div>
  </div>
</template>

<style scoped>
.file-list {
  display: flex;
  flex-direction: column;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  cursor: pointer;
  transition: background 0.1s;
  font-size: 13px;
}

.file-item:hover {
  background: var(--bg-hover);
}

.file-item.selected {
  background: rgba(88, 166, 255, 0.1);
}

.file-checkbox {
  width: 14px;
  height: 14px;
  accent-color: var(--accent-blue);
}

.file-status {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  font-family: monospace;
  border-radius: 2px;
}

.file-path {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: 'SF Mono', 'Menlo', monospace;
  font-size: 12px;
}
</style>
