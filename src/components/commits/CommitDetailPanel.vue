<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { NButton, NSpin, NEmpty } from 'naive-ui'
import { useRepositoryStore } from '../../stores/repository'
import type { GraphCommit } from '../../stores/commits'

const props = defineProps<{
  commit: GraphCommit | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const repoStore = useRepositoryStore()
const repo = computed(() => repoStore.currentRepo)

const files = ref<{ status: string; path: string }[]>([])
const selectedFile = ref<string | null>(null)
const diff = ref('')
const loading = ref(false)
const loadingDiff = ref(false)

watch(() => props.commit, async (commit) => {
  if (!commit || !repo.value) {
    files.value = []
    selectedFile.value = null
    diff.value = ''
    return
  }

  loading.value = true
  try {
    const result = await window.electronAPI.git.commitFiles(repo.value.path, commit.hash)
    files.value = result.files || []
    if (files.value.length > 0) {
      selectedFile.value = files.value[0].path
    }
  } finally {
    loading.value = false
  }
}, { immediate: true })

watch(selectedFile, async (file) => {
  if (!file || !props.commit || !repo.value) {
    diff.value = ''
    return
  }

  loadingDiff.value = true
  try {
    diff.value = await window.electronAPI.git.commitDiff(repo.value.path, props.commit.hash, file)
  } finally {
    loadingDiff.value = false
  }
})

function getStatusSymbol(status: string): string {
  if (status.startsWith('A')) return 'A'
  if (status.startsWith('D')) return 'D'
  if (status.startsWith('R')) return 'R'
  return 'M'
}

function getStatusClass(status: string): string {
  if (status.startsWith('A')) return 'status-added'
  if (status.startsWith('D')) return 'status-deleted'
  if (status.startsWith('R')) return 'status-renamed'
  return 'status-modified'
}

function getDiffLines(text: string) {
  return text.split('\n').map(line => {
    if (line.startsWith('+') && !line.startsWith('+++')) return { type: 'add', text: line }
    if (line.startsWith('-') && !line.startsWith('---')) return { type: 'remove', text: line }
    if (line.startsWith('@@')) return { type: 'hunk', text: line }
    return { type: 'normal', text: line }
  })
}
</script>

<template>
  <div class="commit-detail-panel" v-if="commit">
    <div class="panel-header">
      <div class="commit-info">
        <span class="commit-hash">{{ commit.shortHash }}</span>
        <span class="commit-message">{{ commit.message }}</span>
      </div>
      <button class="close-btn" @click="emit('close')">&#10005;</button>
    </div>

    <div class="panel-meta">
      <span>{{ commit.author }}</span>
      <span>{{ commit.date }}</span>
    </div>

    <div class="panel-content">
      <!-- File list -->
      <div class="file-sidebar">
        <div class="file-header">修改的文件 ({{ files.length }})</div>
        <div class="file-list" v-if="!loading">
          <div
            v-for="file in files"
            :key="file.path"
            class="file-item"
            :class="{ selected: selectedFile === file.path }"
            @click="selectedFile = file.path"
          >
            <span class="file-status" :class="getStatusClass(file.status)">{{ getStatusSymbol(file.status) }}</span>
            <span class="file-path">{{ file.path }}</span>
          </div>
        </div>
        <div v-else class="loading">
          <NSpin size="small" />
        </div>
      </div>

      <!-- Diff view -->
      <div class="diff-panel">
        <div v-if="!loadingDiff && diff" class="diff-content">
          <div
            v-for="(line, i) in getDiffLines(diff)"
            :key="i"
            :class="'diff-line diff-' + line.type"
          >{{ line.text }}</div>
        </div>
        <div v-else-if="loadingDiff" class="loading">
          <NSpin size="small" />
        </div>
        <div v-else class="no-diff">
          <NEmpty description="选择文件查看变更" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.commit-detail-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  border-top: 1px solid var(--border-color);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}

.commit-info {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.commit-hash {
  font-family: monospace;
  font-size: 12px;
  color: var(--accent-blue);
  font-weight: 600;
}

.commit-message {
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.close-btn {
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 14px;
  padding: 4px 8px;
  border-radius: 4px;
}

.close-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.panel-meta {
  display: flex;
  gap: 12px;
  padding: 6px 12px;
  font-size: 11px;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border-color);
}

.panel-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.file-sidebar {
  width: 250px;
  min-width: 200px;
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
}

.file-header {
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--bg-tertiary);
}

.file-list {
  flex: 1;
  overflow-y: auto;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 12px;
}

.file-item:hover {
  background: var(--bg-hover);
}

.file-item.selected {
  background: rgba(88, 166, 255, 0.1);
}

.file-status {
  width: 14px;
  font-size: 11px;
  font-weight: 700;
  font-family: monospace;
}

.file-path {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: monospace;
}

.diff-panel {
  flex: 1;
  overflow: auto;
}

.diff-content {
  font-family: 'Cascadia Code', monospace;
  font-size: 12px;
  line-height: 1.6;
}

.diff-line {
  padding: 0 16px;
  white-space: pre-wrap;
  word-break: break-all;
}

.diff-add {
  background: rgba(63, 185, 80, 0.1);
  color: var(--accent-green);
}

.diff-remove {
  background: rgba(248, 81, 73, 0.1);
  color: var(--accent-red);
}

.diff-hunk {
  background: rgba(188, 140, 255, 0.08);
  color: var(--accent-purple);
}

.diff-normal {
  color: var(--text-primary);
}

.loading {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.no-diff {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
