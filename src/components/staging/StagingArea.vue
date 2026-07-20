<script setup lang="ts">
import { computed, ref } from 'vue'
import { NButton, NInput, NSpace, NEmpty } from 'naive-ui'
import { useRepositoryStore } from '../../stores/repository'
import { useStagingStore } from '../../stores/staging'
import FileList from './FileList.vue'
import DiffViewer from './DiffViewer.vue'

const repoStore = useRepositoryStore()
const stagingStore = useStagingStore()

const selectedFile = ref<string | null>(null)
const repo = computed(() => repoStore.currentRepo)

async function handleStageSelected() {
  if (!repo.value) return
  const files = Array.from(stagingStore.selectedFiles)
  if (files.length > 0) {
    await stagingStore.stageFiles(repo.value.path, files)
    stagingStore.clearSelection()
  }
}

async function handleStageAll() {
  if (!repo.value) return
  await stagingStore.stageAll(repo.value.path)
}

async function handleUnstageSelected() {
  if (!repo.value) return
  const files = Array.from(stagingStore.selectedFiles)
  if (files.length > 0) {
    await stagingStore.unstageFiles(repo.value.path, files)
    stagingStore.clearSelection()
  }
}

async function handleCommit() {
  if (!repo.value || !stagingStore.commitMessage) return
  await window.electronAPI.git.commit(repo.value.path, stagingStore.commitMessage)
  stagingStore.commitMessage = ''
  await stagingStore.fetchStatus(repo.value.path)
}

async function handlePush() {
  if (!repo.value) return
  try {
    await window.electronAPI.git.push(repo.value.path)
  } catch (e: any) {
    console.error('Push failed:', e.message)
  }
}

async function handlePull() {
  if (!repo.value) return
  try {
    await window.electronAPI.git.pull(repo.value.path)
  } catch (e: any) {
    console.error('Pull failed:', e.message)
  }
}

function handleSelectFile(path: string) {
  selectedFile.value = path
}
</script>

<template>
  <div class="staging-area">
    <div class="staging-sidebar">
      <!-- Toolbar -->
      <div class="staging-toolbar">
        <NSpace size="small">
          <NButton size="small" @click="handleStageAll">全部暂存</NButton>
          <NButton
            size="small"
            :disabled="stagingStore.selectedFiles.size === 0"
            @click="handleStageSelected"
          >
            暂存选中
          </NButton>
          <NButton
            size="small"
            :disabled="stagingStore.selectedFiles.size === 0"
            @click="handleUnstageSelected"
          >
            取消暂存
          </NButton>
        </NSpace>
      </div>

      <!-- File list -->
      <div class="file-list-container">
        <NEmpty v-if="stagingStore.files.length === 0" description="工作区干净" />
        <FileList
          v-else
          :files="stagingStore.files"
          :selected-files="stagingStore.selectedFiles"
          :selected-file="selectedFile"
          @select="handleSelectFile"
          @toggle-select="stagingStore.toggleSelect"
        />
      </div>

      <!-- Commit area -->
      <div class="commit-area">
        <NInput
          v-model:value="stagingStore.commitMessage"
          type="textarea"
          placeholder="提交信息..."
          :rows="3"
          :autosize="{ minRows: 2, maxRows: 4 }"
        />
        <NSpace style="margin-top: 8px" size="small">
          <NButton
            type="primary"
            :disabled="!stagingStore.commitMessage || stagingStore.stagedFiles.length === 0"
            @click="handleCommit"
          >
            提交
          </NButton>
          <NButton @click="handlePull">拉取</NButton>
          <NButton @click="handlePush">推送</NButton>
        </NSpace>
      </div>
    </div>

    <!-- Diff viewer -->
    <div class="diff-container">
      <DiffViewer
        v-if="selectedFile && repo"
        :repo-path="repo.path"
        :file-path="selectedFile"
      />
      <div v-else class="no-diff">
        <span>&#128196;</span>
        <p>选择文件查看变更</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.staging-area {
  display: flex;
  height: 100%;
  overflow: hidden;
}

.staging-sidebar {
  width: 40%;
  min-width: 280px;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border-color);
}

.staging-toolbar {
  padding: 8px;
  border-bottom: 1px solid var(--border-color);
}

.file-list-container {
  flex: 1;
  overflow-y: auto;
}

.commit-area {
  padding: 8px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.diff-container {
  flex: 1;
  overflow: auto;
}

.no-diff {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-muted);
  gap: 8px;
}

.no-diff span {
  font-size: 48px;
}
</style>
