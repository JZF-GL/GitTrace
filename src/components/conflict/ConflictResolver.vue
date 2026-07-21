<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { NButton, NSpace, NEmpty, useMessage } from 'naive-ui'
import { useRepositoryStore } from '../../stores/repository'
import { useStagingStore } from '../../stores/staging'

const props = defineProps<{
  files: string[]
}>()

const emit = defineEmits<{
  (e: 'resolved'): void
}>()

const repoStore = useRepositoryStore()
const stagingStore = useStagingStore()
const message = useMessage()
const repo = computed(() => repoStore.currentRepo)

const selectedFile = ref<string | null>(null)
const conflictContent = ref('')
const loading = ref(false)
const resolvedFiles = ref<Set<string>>(new Set())

watch(() => props.files, (val) => {
  if (val.length > 0 && !selectedFile.value) {
    selectedFile.value = val[0]
  }
}, { immediate: true })

watch(selectedFile, async (file) => {
  if (!file || !repo.value) return
  loading.value = true
  try {
    const result = await window.electronAPI.git.conflictFile(repo.value.path, file)
    conflictContent.value = result.working || ''
  } finally {
    loading.value = false
  }
})

function getConflictParts(content: string) {
  const lines = content.split('\n')
  const parts: { type: 'normal' | 'ours' | 'theirs' | 'separator'; text: string }[] = []
  let mode: 'normal' | 'ours' | 'theirs' = 'normal'

  for (const line of lines) {
    if (line.startsWith('<<<<<<<')) {
      mode = 'ours'
      continue
    } else if (line.startsWith('=======')) {
      mode = 'theirs'
      continue
    } else if (line.startsWith('>>>>>>>')) {
      mode = 'normal'
      continue
    }

    if (mode === 'ours') {
      parts.push({ type: 'ours', text: line })
    } else if (mode === 'theirs') {
      parts.push({ type: 'theirs', text: line })
    } else {
      parts.push({ type: 'normal', text: line })
    }
  }
  return parts
}

async function resolveWithOurs() {
  if (!selectedFile.value || !repo.value) return
  // Get the ours version
  const result = await window.electronAPI.git.conflictFile(repo.value.path, selectedFile.value)
  const resolved = await window.electronAPI.git.resolveConflict(repo.value.path, selectedFile.value, result.ours)
  if (resolved.success) {
    message.success(resolved.message)
    resolvedFiles.value.add(selectedFile.value)
    await stagingStore.fetchStatus(repo.value.path)
    // Select next unresolved file
    const next = props.files.find(f => !resolvedFiles.value.has(f))
    selectedFile.value = next || null
    if (!next) emit('resolved')
  } else {
    message.error(resolved.message)
  }
}

async function resolveWithTheirs() {
  if (!selectedFile.value || !repo.value) return
  const result = await window.electronAPI.git.conflictFile(repo.value.path, selectedFile.value)
  const resolved = await window.electronAPI.git.resolveConflict(repo.value.path, selectedFile.value, result.theirs)
  if (resolved.success) {
    message.success(resolved.message)
    resolvedFiles.value.add(selectedFile.value)
    await stagingStore.fetchStatus(repo.value.path)
    const next = props.files.find(f => !resolvedFiles.value.has(f))
    selectedFile.value = next || null
    if (!next) emit('resolved')
  } else {
    message.error(resolved.message)
  }
}

async function resolveWithEdited() {
  if (!selectedFile.value || !repo.value) return
  const resolved = await window.electronAPI.git.resolveConflict(repo.value.path, selectedFile.value, conflictContent.value)
  if (resolved.success) {
    message.success(resolved.message)
    resolvedFiles.value.add(selectedFile.value)
    await stagingStore.fetchStatus(repo.value.path)
    const next = props.files.find(f => !resolvedFiles.value.has(f))
    selectedFile.value = next || null
    if (!next) emit('resolved')
  } else {
    message.error(resolved.message)
  }
}
</script>

<template>
  <div class="conflict-resolver">
    <div class="conflict-sidebar">
      <div class="section-header">
        <span class="section-title">冲突文件 ({{ files.length }})</span>
      </div>
      <div class="file-list">
        <div
          v-for="file in files"
          :key="file"
          class="file-item"
          :class="{ selected: selectedFile === file, resolved: resolvedFiles.has(file) }"
          @click="selectedFile = file"
        >
          <span class="file-status">{{ resolvedFiles.has(file) ? '&#10003;' : '!' }}</span>
          <span class="file-path">{{ file }}</span>
        </div>
      </div>
    </div>

    <div class="conflict-editor">
      <div class="editor-header" v-if="selectedFile">
        <span class="file-name">{{ selectedFile }}</span>
        <NSpace size="small">
          <NButton size="small" type="success" @click="resolveWithOurs" :disabled="resolvedFiles.has(selectedFile)">使用当前</NButton>
          <NButton size="small" type="warning" @click="resolveWithTheirs" :disabled="resolvedFiles.has(selectedFile)">使用传入</NButton>
          <NButton size="small" type="primary" @click="resolveWithEdited" :disabled="resolvedFiles.has(selectedFile)">使用编辑内容</NButton>
        </NSpace>
      </div>
      <div class="editor-content" v-if="selectedFile">
        <div class="conflict-view">
          <div
            v-for="(part, i) in getConflictParts(conflictContent)"
            :key="i"
            :class="'conflict-line conflict-' + part.type"
          >
            {{ part.text }}
          </div>
        </div>
      </div>
      <div v-else class="no-selection">
        <NEmpty description="选择冲突文件" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.conflict-resolver {
  display: flex;
  height: 100%;
  overflow: hidden;
}

.conflict-sidebar {
  width: 250px;
  min-width: 200px;
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
}

.section-header {
  padding: 8px 12px;
  background: var(--bg-tertiary);
}

.section-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-secondary);
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

.file-item.resolved {
  color: var(--accent-green);
}

.file-status {
  width: 16px;
  text-align: center;
}

.file-path {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: monospace;
}

.conflict-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.file-name {
  font-family: monospace;
  font-size: 12px;
  color: var(--text-secondary);
}

.editor-content {
  flex: 1;
  overflow: auto;
}

.conflict-view {
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  font-size: 12px;
  line-height: 1.6;
}

.conflict-line {
  padding: 0 16px;
  white-space: pre-wrap;
  word-break: break-all;
}

.conflict-normal {
  background: transparent;
  color: var(--text-primary);
}

.conflict-ours {
  background: rgba(63, 185, 80, 0.12);
  color: #7ee787;
}

.conflict-theirs {
  background: rgba(248, 81, 73, 0.12);
  color: #ffa198;
}

.no-selection {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
