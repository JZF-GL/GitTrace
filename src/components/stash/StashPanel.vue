<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { NButton, NSpace, NEmpty, NInput, NModal } from 'naive-ui'
import { useRepositoryStore } from '../../stores/repository'
import { useStagingStore } from '../../stores/staging'

const repoStore = useRepositoryStore()
const stagingStore = useStagingStore()
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

async function handleStashPush() {
  if (!repo.value) return
  await window.electronAPI.git.stashPush(repo.value.path, stashMessage.value || undefined)
  stashMessage.value = ''
  showStashCreate.value = false
  await fetchStashList()
  if (repo.value) {
    await stagingStore.fetchStatus(repo.value.path)
  }
}

async function handleStashPop() {
  if (!repo.value) return
  await window.electronAPI.git.stashPop(repo.value.path)
  await fetchStashList()
  if (repo.value) {
    await stagingStore.fetchStatus(repo.value.path)
  }
}

async function handleStashDrop(stashRef: string) {
  if (!repo.value) return
  await window.electronAPI.git.stashDrop(repo.value.path, stashRef)
  await fetchStashList()
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
        <NButton @click="handleStashPop" :disabled="stashList.length === 0">
          弹出最近 Stash
        </NButton>
      </NSpace>
    </div>

    <div class="stash-list">
      <NEmpty v-if="stashList.length === 0" description="暂无 Stash" />
      <div v-for="stash in stashList" :key="stash.hash" class="stash-item">
        <div class="stash-info">
          <span class="stash-ref">{{ stash.hash }}</span>
          <span class="stash-message">{{ stash.message || '(无消息)' }}</span>
          <span class="stash-date">{{ stash.date }}</span>
        </div>
        <NSpace size="small">
          <NButton size="tiny" @click="handleStashPop">应用</NButton>
          <NButton size="tiny" type="error" @click="handleStashDrop(stash.hash)">删除</NButton>
        </NSpace>
      </div>
    </div>

    <NModal v-model:show="showStashCreate">
      <div class="modal-content">
        <h3>创建 Stash</h3>
        <NInput v-model:value="stashMessage.value" placeholder="消息 (可选)" style="margin-top: 12px" />
        <NSpace style="margin-top: 12px">
          <NButton type="primary" @click="handleStashPush">暂存</NButton>
          <NButton @click="showStashCreate = false">取消</NButton>
        </NSpace>
      </div>
    </NModal>
  </div>
</template>

<style scoped>
.stash-panel {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
}

.stash-list {
  flex: 1;
  overflow-y: auto;
}

.stash-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: 6px;
  margin-bottom: 8px;
}

.stash-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stash-ref {
  font-family: monospace;
  font-size: 12px;
  color: var(--accent-orange);
}

.stash-message {
  font-size: 13px;
}

.stash-date {
  font-size: 11px;
  color: var(--text-muted);
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
