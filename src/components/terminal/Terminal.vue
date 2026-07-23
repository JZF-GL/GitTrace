<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { NSelect, useMessage } from 'naive-ui'
import { useRepositoryStore } from '../../stores/repository'
import { useTerminalStore } from '../../stores/terminal'

const repoStore = useRepositoryStore()
const terminalStore = useTerminalStore()
const message = useMessage()
const repo = computed(() => repoStore.currentRepo)

const input = ref('')
const historyIndex = ref(-1)
const outputRef = ref<HTMLElement | null>(null)

const gitCommands = [
  { label: 'git status', value: 'git status' },
  { label: 'git add .', value: 'git add .' },
  { label: 'git add -A', value: 'git add -A' },
  { label: 'git commit -m ""', value: 'git commit -m ""' },
  { label: 'git push', value: 'git push' },
  { label: 'git pull', value: 'git pull' },
  { label: 'git fetch', value: 'git fetch' },
  { label: 'git log --oneline -20', value: 'git log --oneline -20' },
  { label: 'git diff', value: 'git diff' },
  { label: 'git diff --cached', value: 'git diff --cached' },
  { label: 'git branch', value: 'git branch' },
  { label: 'git branch -a', value: 'git branch -a' },
  { label: 'git merge ', value: 'git merge ' },
  { label: 'git stash', value: 'git stash' },
  { label: 'git stash pop', value: 'git stash pop' },
  { label: 'git checkout ', value: 'git checkout ' },
  { label: 'git reset HEAD~1', value: 'git reset HEAD~1' },
  { label: 'git restore ', value: 'git restore ' },
]

function handleCommandSelect(value: string) {
  input.value = value
  // 如果命令末尾有空格，将光标移到末尾
  if (value.endsWith(' ')) {
    nextTick(() => {
      const el = document.querySelector('.input-field') as HTMLInputElement
      if (el) el.focus()
    })
  }
}

async function executeCommand() {
  const cmd = input.value.trim()
  if (!cmd || !repo.value) return

  terminalStore.addCommandHistory(cmd)
  historyIndex.value = terminalStore.commandHistory.length

  terminalStore.addHistory(`$ ${cmd}`)

  try {
    const result = await window.electronAPI.git.exec(repo.value.path, cmd)
    if (result.stdout) {
      terminalStore.addHistory(result.stdout)
    }
    if (result.stderr) {
      terminalStore.addHistory(`[错误] ${result.stderr}`)
    }
    if (!result.stdout && !result.stderr) {
      terminalStore.addHistory('[无输出]')
    }
  } catch (e: any) {
    terminalStore.addHistory(`[错误] ${e.message || String(e)}`)
  }

  input.value = ''
  await nextTick()
  scrollToBottom()
}

function scrollToBottom() {
  if (outputRef.value) {
    outputRef.value.scrollTop = outputRef.value.scrollHeight
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    executeCommand()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (historyIndex.value > 0) {
      historyIndex.value--
      input.value = terminalStore.commandHistory[historyIndex.value] || ''
    }
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (historyIndex.value < terminalStore.commandHistory.length - 1) {
      historyIndex.value++
      input.value = terminalStore.commandHistory[historyIndex.value] || ''
    } else {
      historyIndex.value = terminalStore.commandHistory.length
      input.value = ''
    }
  }
}

function clearHistory() {
  terminalStore.clearHistory()
}
</script>

<template>
  <div class="terminal-container">
    <div class="terminal-header">
      <span class="terminal-title">Git 终端</span>
      <span class="terminal-path">{{ repo?.path || '' }}</span>
      <button class="clear-btn" @click="clearHistory">清空</button>
    </div>
    <div class="terminal-output" ref="outputRef">
      <div v-if="terminalStore.history.length === 0" class="terminal-hint">
        输入 git 命令开始操作，支持上下箭头切换历史命令
      </div>
      <div v-for="(line, i) in terminalStore.history" :key="i" class="terminal-line">
        <span v-if="line.startsWith('$')" class="command-line">{{ line }}</span>
        <span v-else-if="line.startsWith('[错误]')" class="error-line">{{ line }}</span>
        <span v-else class="output-line">{{ line }}</span>
      </div>
    </div>
    <div class="terminal-input">
      <span class="prompt">{{ repo?.name || 'repo' }} $</span>
      <NSelect
        :options="gitCommands"
        placeholder="常用命令"
        size="small"
        style="width: 180px; flex-shrink: 0;"
        @update:value="handleCommandSelect"
        :show-arrow="true"
        filterable
      />
      <input
        v-model="input"
        class="input-field"
        placeholder="输入 git 命令..."
        @keydown="handleKeydown"
        autofocus
      />
    </div>
  </div>
</template>

<style scoped>
.terminal-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #1e1e1e;
  font-family: 'Cascadia Code', 'Fira Code', 'SF Mono', monospace;
}

.terminal-header {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: #2d2d2d;
  border-bottom: 1px solid #404040;
  gap: 12px;
}

.terminal-title {
  font-size: 12px;
  color: #ccc;
  font-weight: 500;
}

.terminal-path {
  font-size: 11px;
  color: #666;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.clear-btn {
  border: none;
  background: transparent;
  color: #888;
  cursor: pointer;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.15s;
  flex-shrink: 0;
}

.clear-btn:hover {
  background: #404040;
  color: #fff;
}

.terminal-output {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  font-size: 13px;
  line-height: 1.5;
}

.terminal-hint {
  color: #666;
  font-style: italic;
}

.terminal-line {
  white-space: pre-wrap;
  word-break: break-all;
}

.command-line {
  color: #4ec9b0;
}

.error-line {
  color: #f85149;
}

.output-line {
  color: #d4d4d4;
}

.terminal-input {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-top: 1px solid #404040;
  background: #2d2d2d;
  gap: 8px;
}

.prompt {
  color: #4ec9b0;
  font-size: 13px;
  flex-shrink: 0;
}

.input-field {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: #d4d4d4;
  font-family: inherit;
  font-size: 13px;
}

.input-field::placeholder {
  color: #666;
}

:deep(.n-select) {
  --n-border: 1px solid #404040;
  --n-border-hover: 1px solid #555;
  --n-border-active: 1px solid #4ec9b0;
  --n-border-focus: 1px solid #4ec9b0;
  --n-color: #2d2d2d;
  --n-color-active: #2d2d2d;
  --n-text-color: #d4d4d4;
  --n-placeholder-color: #666;
}

:deep(.n-base-selection) {
  background: #2d2d2d !important;
  border: 1px solid #404040 !important;
}

:deep(.n-base-selection:hover) {
  border-color: #555 !important;
}

:deep(.n-base-selection--active) {
  border-color: #4ec9b0 !important;
}

:deep(.n-base-selection-label) {
  color: #d4d4d4;
}

:deep(.n-base-select-option) {
  background: #2d2d2d;
  color: #d4d4d4;
}

:deep(.n-base-select-option:hover) {
  background: #404040;
}

:deep(.n-base-select-option--selected) {
  color: #4ec9b0;
}
</style>
