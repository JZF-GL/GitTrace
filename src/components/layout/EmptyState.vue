<script setup lang="ts">
import { NButton } from 'naive-ui'
import { useRepositoryStore } from '../../stores/repository'

const repoStore = useRepositoryStore()

async function openFolder() {
  const path = await window.electronAPI.dialog.openFolder()
  if (path) {
    const entry = await repoStore.addRepo(path)
    repoStore.selectRepo(entry)
  }
}
</script>

<template>
  <div class="empty-state">
    <div class="empty-icon">&#128269;</div>
    <h2>欢迎使用 GitTrace</h2>
    <p>选择或添加一个 Git 仓库开始</p>
    <NButton type="primary" size="large" @click="openFolder">
      打开仓库
    </NButton>
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
  color: var(--text-secondary);
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 8px;
}

h2 {
  color: var(--text-primary);
  font-weight: 600;
}

p {
  font-size: 14px;
}
</style>
