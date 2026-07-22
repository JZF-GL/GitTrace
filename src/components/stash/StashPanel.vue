<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { NButton, NSpace, NEmpty, NInput, NModal, useMessage } from 'naive-ui'
import { useRepositoryStore } from '../../stores/repository'
import { useStagingStore } from '../../stores/staging'

const repoStore = useRepositoryStore()
const stagingStore = useStagingStore()
const message = useMessage()
const repo = computed(() => repoStore.currentRepo)

const stashList = ref<any[]>([])
const loading = ref(false)
const showStashCreate = ref(false)
const stashMessage = ref('')

async function fetchStashList() {
  if (!repo.value) return
  loading.value = true
  try {
    const result = await window.electronAPI.git.stashList(repo.value.path)
    stashList.value = result.all || []
  } finally {
    loading.value = false
  }
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  if (hours < 24) return `${hours} 小时前`
  if (days < 7) return `${days} 天前`
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

async function handleStashPush() {
  if (!repo.value) return
  const result = await window.electronAPI.git.stashPush(repo.value.path, stashMessage.value || undefined)
  if (result?.success) {
    message.success(result.message)
    stashMessage.value = ''
    showStashCreate.value = false
    await fetchStashList()
    await stagingStore.fetchStatus(repo.value.path)
  } else {
    message.error('暂存失败: ' + (result?.message || '未知错误'))
  }
}

async function handleStashPop(index?: number) {
  if (!repo.value) return
  const stashRef = index !== undefined ? `stash@{${index}}` : undefined
  const result = await window.electronAPI.git.stashPop(repo.value.path, stashRef)
  if (result?.success) {
    message.success(result.message)
    await fetchStashList()
    await stagingStore.fetchStatus(repo.value.path)
  } else {
    message.error('弹出失败: ' + (result?.message || '未知错误'))
  }
}

async function handleStashDrop(index: number) {
  if (!repo.value) return
  const stashRef = `stash@{${index}}`
  const result = await window.electronAPI.git.stashDrop(repo.value.path, stashRef)
  if (result?.success) {
    message.success(result.message)
    await fetchStashList()
  } else {
    message.error('删除失败: ' + (result?.message || '未知错误'))
  }
}

onMounted(fetchStashList)
</script>

<template>
  <div class="stash-panel">
    <div class="stash-actions">
      <NSpace>
        <NButton type="primary" @click="showStashCreate = true" :disabled="stagingStore.stagedFiles.length === 0 && stagingStore.unstagedFiles.length === 0">
          暂存更改
        </NButton>
        <NButton @click="handleStashPop()" :disabled="stashList.length === 0">
          弹出最近
        </NButton>
      </NSpace>
    </div>

    <div class="stash-list">
      <NEmpty v-if="stashList.length === 0" description="暂无 Stash" />
      <div v-for="(stash, index) in stashList" :key="stash.hash" class="stash-item">
        <div class="stash-left">
          <div class="stash-header">
            <span class="stash-index">stash@{{ '{' + index + '}' }}</span>
            <span class="stash-date">{{ formatDate(stash.date) }}</span>
          </div>
          <div class="stash-message">{{ stash.message || '(无消息)' }}</div>
        </div>
        <div class="stash-actions-row">
          <NButton size="tiny" quaternary @click="handleStashPop(index)">应用</NButton>
          <NButton size="tiny" quaternary type="error" @click="handleStashDrop(index)">删除</NButton>
        </div>
      </div>
    </div>

    <NModal v-model:show="showStashCreate">
      <div class="modal-content">
        <h3>创建 Stash</h3>
        <NInput v-model:value="stashMessage" placeholder="备注信息 (可选)" style="margin-top: 12px" />
        <NSpace style="margin-top: 16px">
          <NButton type="primary" @click="handleStashPush">暂存</NButton>
          <NButton @click="showStashCreate = false">取消</NButton>
        </NSpace>
      </div>
    </NModal>
  </div>
</template>

<style scoped>
.stash-panel {
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  min-height: 0;
}

.stash-actions {
  flex-shrink: 0;
}

.stash-list {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.stash-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  background: var(--bg-secondary);
  border-radius: 8px;
  margin-bottom: 8px;
  border: 1px solid transparent;
  transition: all 0.15s;
}

.stash-item:hover {
  border-color: var(--border-color);
  background: var(--bg-tertiary);
}

.stash-left {
  flex: 1;
  min-width: 0;
}

.stash-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
}

.stash-index {
  font-family: monospace;
  font-size: 12px;
  font-weight: 600;
  color: var(--accent-orange);
  background: rgba(210, 153, 34, 0.12);
  padding: 2px 8px;
  border-radius: 4px;
}

.stash-date {
  font-size: 11px;
  color: var(--text-muted);
}

.stash-message {
  font-size: 13px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stash-actions-row {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
  margin-left: 12px;
}

.modal-content {
  background: var(--bg-secondary);
  padding: 24px;
  border-radius: 8px;
  min-width: 400px;
}

.modal-content h3 {
  margin: 0;
  color: var(--text-primary);
}
</style>
