<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { NEmpty, NSpin, NButton } from 'naive-ui'

interface GitLogEntry {
  id: string
  timestamp: number
  repoName: string
  repoPath: string
  operation: string
  command: string
  success: boolean
  message: string
  duration?: number
}

const logs = ref<GitLogEntry[]>([])
const loading = ref(false)
const showPopup = ref(false)
let hoverTimer: ReturnType<typeof setTimeout> | null = null

async function fetchLogs() {
  loading.value = true
  try {
    logs.value = await window.electronAPI.git.getLogs(50)
  } catch (e) {
    console.error('Failed to fetch logs:', e)
  } finally {
    loading.value = false
  }
}

async function handleClearLogs() {
  await window.electronAPI.git.clearLogs()
  logs.value = []
}

function handleMouseEnter() {
  if (hoverTimer) clearTimeout(hoverTimer)
  showPopup.value = true
  fetchLogs()
}

function handleMouseLeave() {
  hoverTimer = setTimeout(() => {
    showPopup.value = false
  }, 200)
}

function handlePopupMouseEnter() {
  if (hoverTimer) clearTimeout(hoverTimer)
}

function handlePopupMouseLeave() {
  showPopup.value = false
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return '刚刚'
  if (diffMins < 60) return `${diffMins}分钟前`
  if (diffHours < 24) return `${diffHours}小时前`
  if (diffDays < 7) return `${diffDays}天前`
  return date.toLocaleDateString('zh-CN')
}

function formatDuration(ms?: number): string {
  if (!ms) return ''
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function getOperationIcon(operation: string): string {
  const icons: Record<string, string> = {
    commit: '📝',
    push: '⬆️',
    pull: '⬇️',
    fetch: '🔄',
    branch: '🌿',
    checkout: '🔀',
    merge: '🔗',
    stash: '📦',
    tag: '🏷️',
    remote: '🌐',
    publish: '🚀',
  }
  return icons[operation] || '⚙️'
}

onMounted(() => {
  fetchLogs()
})

onUnmounted(() => {
  if (hoverTimer) clearTimeout(hoverTimer)
})
</script>

<template>
  <div class="git-log-trigger" @mouseenter="handleMouseEnter" @mouseleave="handleMouseLeave">
    <button class="action-btn" title="Git 操作日志">
      📋
    </button>
    
    <Transition name="popup">
      <div v-if="showPopup" class="git-log-popup" @mouseenter="handlePopupMouseEnter" @mouseleave="handlePopupMouseLeave">
        <div class="popup-header">
          <span class="popup-title">Git 操作日志</span>
          <button class="clear-btn" @click="handleClearLogs" title="清空日志">清空</button>
        </div>
        
        <div class="popup-content">
          <div v-if="loading" class="popup-loading">
            <NSpin size="small" />
          </div>
          
          <div v-else-if="logs.length === 0" class="popup-empty">
            <NEmpty description="暂无操作日志" size="small" />
          </div>
          
          <div v-else class="log-list">
            <div v-for="log in logs" :key="log.id" class="log-item" :class="{ 'log-error': !log.success }">
              <div class="log-header">
                <span class="log-icon">{{ getOperationIcon(log.operation) }}</span>
                <span class="log-operation">{{ log.operation }}</span>
                <span class="log-repo">{{ log.repoName }}</span>
                <span class="log-time">{{ formatTime(log.timestamp) }}</span>
              </div>
              <div class="log-command">{{ log.command }}</div>
              <div class="log-message" :class="{ 'text-error': !log.success }">
                {{ log.message }}
                <span v-if="log.duration" class="log-duration">{{ formatDuration(log.duration) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.git-log-trigger {
  position: relative;
}

.git-log-popup {
  position: absolute;
  top: 0;
  right: calc(100% + 8px);
  width: 300px;
  height: 300px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.popup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-tertiary);
}

.popup-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.clear-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.15s;
}

.clear-btn:hover {
  background: var(--bg-hover);
  color: var(--accent-red);
}

.popup-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.popup-loading,
.popup-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.log-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.log-item {
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-color);
  transition: background 0.15s;
}

.log-item:last-child {
  border-bottom: none;
}

.log-item:hover {
  background: var(--bg-hover);
}

.log-item.log-error {
  background: rgba(248, 81, 73, 0.05);
}

.log-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.log-icon {
  font-size: 14px;
}

.log-operation {
  font-size: 12px;
  font-weight: 600;
  color: var(--accent-blue);
  text-transform: capitalize;
}

.log-repo {
  font-size: 11px;
  color: var(--text-muted);
  background: var(--bg-tertiary);
  padding: 1px 6px;
  border-radius: 4px;
}

.log-time {
  font-size: 11px;
  color: var(--text-muted);
  margin-left: auto;
}

.log-command {
  font-size: 11px;
  color: var(--text-secondary);
  font-family: 'Cascadia Code', monospace;
  background: var(--bg-primary);
  padding: 4px 8px;
  border-radius: 4px;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.log-message {
  font-size: 12px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.log-message.text-error {
  color: var(--accent-red);
}

.log-duration {
  font-size: 10px;
  color: var(--text-muted);
  background: var(--bg-tertiary);
  padding: 1px 4px;
  border-radius: 3px;
}

/* Popup transition */
.popup-enter-active,
.popup-leave-active {
  transition: all 0.2s ease;
}

.popup-enter-from,
.popup-leave-to {
  opacity: 0;
  transform: translateX(8px);
}

.action-btn {
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 16px;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.15s;
}

.action-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
</style>
