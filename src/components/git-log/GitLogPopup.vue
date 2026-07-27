<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { NEmpty, NSpin } from 'naive-ui'

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
const logsLoaded = ref(false)
let hoverTimer: ReturnType<typeof setTimeout> | null = null

async function fetchLogs() {
  loading.value = true
  try {
    logs.value = await window.electronAPI.git.getLogs(50)
    logsLoaded.value = true
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
  if (!showPopup.value) {
    showPopup.value = true
    fetchLogs()
  }
}

function handleMouseLeave() {
  hoverTimer = setTimeout(() => {
    showPopup.value = false
    logsLoaded.value = false
  }, 200)
}

function handlePopupMouseEnter() {
  if (hoverTimer) clearTimeout(hoverTimer)
}

function handlePopupMouseLeave() {
  showPopup.value = false
  logsLoaded.value = false
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

// Copy
const copiedId = ref<string | null>(null)
let copyTimer: ReturnType<typeof setTimeout> | null = null

function copyToClipboard(log: GitLogEntry) {
  const text = `[${log.operation}] ${log.command}\n${log.message}`
  navigator.clipboard.writeText(text)
  copiedId.value = log.id
  if (copyTimer) clearTimeout(copyTimer)
  copyTimer = setTimeout(() => { copiedId.value = null }, 1500)
}

// Tooltip (fixed positioning, teleported to body)
const tooltip = ref<{ show: boolean; text: string; top: number; left: number }>({ show: false, text: '', top: 0, left: 0 })
let tooltipTimer: ReturnType<typeof setTimeout> | null = null

function showTooltip(e: MouseEvent, text: string) {
  const el = e.currentTarget as HTMLElement
  if (!el || el.scrollWidth <= el.offsetWidth) return
  if (tooltipTimer) clearTimeout(tooltipTimer)
  const rect = el.getBoundingClientRect()
  tooltip.value = {
    show: true,
    text,
    top: rect.top,
    left: rect.left - 8,
  }
}

function hideTooltip() {
  tooltipTimer = setTimeout(() => {
    tooltip.value.show = false
  }, 100)
}

function keepTooltip() {
  if (tooltipTimer) clearTimeout(tooltipTimer)
}

onMounted(() => {
  fetchLogs()
})

onUnmounted(() => {
  if (hoverTimer) clearTimeout(hoverTimer)
  if (copyTimer) clearTimeout(copyTimer)
  if (tooltipTimer) clearTimeout(tooltipTimer)
})
</script>

<template>
  <div class="git-log-trigger" @mouseenter="handleMouseEnter" @mouseleave="handleMouseLeave">
    <button class="action-btn">📋</button>
    
    <Transition name="popup">
      <div v-if="showPopup" class="git-log-popup" @mouseenter="handlePopupMouseEnter" @mouseleave="handlePopupMouseLeave">
        <div class="popup-header">
          <span class="popup-title">Git 操作日志</span>
          <button class="clear-btn" @click="handleClearLogs">清空</button>
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
                <span
                  class="log-repo"
                  @mouseenter="showTooltip($event, log.repoName)"
                  @mouseleave="hideTooltip"
                >{{ log.repoName }}</span>
                <span class="log-time">{{ formatTime(log.timestamp) }}</span>
              </div>
              <div
                class="log-command"
                @mouseenter="showTooltip($event, log.command)"
                @mouseleave="hideTooltip"
              >{{ log.command }}</div>
              <div class="log-message" :class="{ 'text-error': !log.success }">
                <span
                  class="msg-text"
                  @mouseenter="showTooltip($event, log.message)"
                  @mouseleave="hideTooltip"
                >{{ log.message }}</span>
                <span v-if="log.duration" class="log-duration">{{ formatDuration(log.duration) }}</span>
                <button
                  class="copy-btn"
                  :class="{ copied: copiedId === log.id }"
                  @click.stop="copyToClipboard(log)"
                >
                  <svg v-if="copiedId !== log.id" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>

  <Teleport to="body">
    <Transition name="tooltip">
      <div
        v-if="tooltip.show"
        class="custom-tooltip"
        :style="{ top: tooltip.top + 'px', left: tooltip.left + 'px' }"
        @mouseenter="keepTooltip"
        @mouseleave="hideTooltip"
      >
        <div class="tooltip-content">{{ tooltip.text }}</div>
      </div>
    </Transition>
  </Teleport>
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
  gap: 6px;
  margin-bottom: 4px;
}

.log-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.log-operation {
  font-size: 12px;
  font-weight: 600;
  color: var(--accent-blue);
  text-transform: capitalize;
  flex-shrink: 0;
}

.log-repo {
  font-size: 11px;
  color: var(--text-muted);
  background: var(--bg-tertiary);
  padding: 1px 6px;
  border-radius: 4px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.log-time {
  font-size: 11px;
  color: var(--text-muted);
  margin-left: auto;
  flex-shrink: 0;
  white-space: nowrap;
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

.log-message .msg-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
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
  flex-shrink: 0;
  white-space: nowrap;
}

.copy-btn {
  border: none;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  flex-shrink: 0;
  border-radius: 3px;
  transition: opacity 0.15s, color 0.15s, background 0.15s;
}

.log-item:hover .copy-btn {
  opacity: 1;
}

.copy-btn:hover {
  color: var(--accent-blue);
  background: rgba(96, 165, 250, 0.1);
}

.copy-btn.copied {
  opacity: 1;
  color: var(--accent-green, #4ade80);
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

<style>
/* Tooltip - global, not scoped, teleported to body */
.custom-tooltip {
  position: fixed;
  z-index: 9999;
  pointer-events: auto;
  transform: translateX(-100%);
}

.tooltip-content {
  max-width: 260px;
  padding: 8px 12px;
  background: var(--bg-tertiary, #1e1e2e);
  border: 1px solid var(--border-color, #313244);
  border-radius: 6px;
  font-size: 12px;
  color: var(--text-primary, #cdd6f4);
  line-height: 1.5;
  word-break: break-all;
  white-space: pre-wrap;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

.tooltip-enter-active,
.tooltip-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.tooltip-enter-from,
.tooltip-leave-to {
  opacity: 0;
  transform: translateX(-100%) translateX(4px);
}
</style>
