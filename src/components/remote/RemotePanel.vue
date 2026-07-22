<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { NButton, NSpace, NEmpty, NInput, NModal, NAlert } from 'naive-ui'
import { useRepositoryStore } from '../../stores/repository'

const repoStore = useRepositoryStore()
const repo = computed(() => repoStore.currentRepo)

const remotes = ref<any[]>([])
const loading = ref(false)
const progress = ref('')
const error = ref('')
const showAddRemote = ref(false)
const newRemoteName = ref('')
const newRemoteUrl = ref('')

async function fetchRemotes() {
  if (!repo.value) return
  remotes.value = await window.electronAPI.git.remoteList(repo.value.path)
}

async function handleFetch() {
  if (!repo.value) return
  loading.value = true
  error.value = ''
  progress.value = '正在获取...'
  try {
    await window.electronAPI.git.fetch(repo.value.path)
    progress.value = '获取完成'
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
    setTimeout(() => { progress.value = '' }, 2000)
  }
}

async function handlePull() {
  if (!repo.value) return
  loading.value = true
  error.value = ''
  progress.value = '正在拉取...'
  try {
    await window.electronAPI.git.pull(repo.value.path)
    progress.value = '拉取完成'
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
    setTimeout(() => { progress.value = '' }, 2000)
  }
}

async function handlePush() {
  if (!repo.value) return
  loading.value = true
  error.value = ''
  progress.value = '正在推送...'
  try {
    await window.electronAPI.git.push(repo.value.path)
    progress.value = '推送完成'
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
    setTimeout(() => { progress.value = '' }, 2000)
  }
}

async function handleAddRemote() {
  if (!repo.value || !newRemoteName.value || !newRemoteUrl.value) return
  await window.electronAPI.git.remoteAdd(repo.value.path, newRemoteName.value, newRemoteUrl.value)
  await fetchRemotes()
  showAddRemote.value = false
  newRemoteName.value = ''
  newRemoteUrl.value = ''
}

async function handleRemoveRemote(name: string) {
  if (!repo.value) return
  await window.electronAPI.git.remoteRemove(repo.value.path, name)
  await fetchRemotes()
}

onMounted(fetchRemotes)
</script>

<template>
  <div class="remote-panel">
    <div class="remote-actions">
      <NSpace>
        <NButton :loading="loading" @click="handleFetch">获取</NButton>
        <NButton :loading="loading" @click="handlePull">拉取</NButton>
        <NButton type="primary" :loading="loading" @click="handlePush">推送</NButton>
        <NButton @click="showAddRemote = true">添加远程</NButton>
      </NSpace>
      <div v-if="progress" class="progress">{{ progress }}</div>
      <NAlert v-if="error" type="error" :title="error" closable @close="error = ''" />
    </div>

    <div class="remote-list">
      <NEmpty v-if="remotes.length === 0" description="暂无远程仓库" />
      <div v-for="remote in remotes" :key="remote.name" class="remote-item">
        <div class="remote-info">
          <span class="remote-name">{{ remote.name }}</span>
          <span class="remote-url">{{ remote.refs.fetch }}</span>
        </div>
        <button class="remove-btn" @click="handleRemoveRemote(remote.name)">&#10005;</button>
      </div>
    </div>

    <NModal v-model:show="showAddRemote">
      <div class="modal-content">
        <h3>添加远程仓库</h3>
        <NInput v-model:value="newRemoteName" placeholder="名称 (如 origin)" style="margin-top: 12px" />
        <NInput v-model:value="newRemoteUrl" placeholder="URL" style="margin-top: 8px" />
        <NSpace style="margin-top: 12px">
          <NButton type="primary" @click="handleAddRemote" :disabled="!newRemoteName.value || !newRemoteUrl.value">添加</NButton>
          <NButton @click="showAddRemote = false">取消</NButton>
        </NSpace>
      </div>
    </NModal>
  </div>
</template>

<style scoped>
.remote-panel {
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  min-height: 0;
}

.remote-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
}

.progress {
  font-size: 12px;
  color: var(--accent-blue);
}

.remote-list {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.remote-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: 6px;
  margin-bottom: 8px;
}

.remote-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.remote-name {
  font-weight: 600;
  font-size: 14px;
}

.remote-url {
  font-size: 12px;
  color: var(--text-secondary);
  font-family: monospace;
}

.remove-btn {
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
}

.remove-btn:hover {
  background: rgba(248, 81, 73, 0.2);
  color: var(--accent-red);
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
