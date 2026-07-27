<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { NModal, NRadioGroup, NRadio, NInput, NButton, NTag, NAlert, useMessage } from 'naive-ui'
import draggable from 'vuedraggable'
import { useSettingsStore, type Settings } from '../../stores/settings'
import { useRepositoryStore } from '../../stores/repository'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ (e: 'update:show', value: boolean): void }>()

const message = useMessage()
const settingsStore = useSettingsStore()
const repoStore = useRepositoryStore()

const repoPath = computed(() => repoStore.currentRepo?.path)
const scope = ref<'global' | 'project'>('global')
const saving = ref(false)

const prefixList = ref<string[]>([])
const commandList = ref<string[]>([])
const newPrefix = ref('')
const newCommand = ref('')

// 计算全局新增的项
const globalPrefixes = computed(() => settingsStore.settings?.commitPrefixes.global ?? [])
const globalCommands = computed(() => settingsStore.settings?.terminalCommands.global ?? [])

const newGlobalPrefixes = computed(() => {
  if (scope.value !== 'project' || !repoPath.value) return []
  return globalPrefixes.value.filter(p => !prefixList.value.includes(p))
})

const newGlobalCommands = computed(() => {
  if (scope.value !== 'project' || !repoPath.value) return []
  return globalCommands.value.filter(c => !commandList.value.includes(c))
})

const DEFAULT_PREFIXES = ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert']
const DEFAULT_COMMANDS = [
  'git status', 'git add .', 'git add -A', 'git commit -m ""',
  'git push', 'git pull', 'git fetch', 'git log --oneline -20',
  'git diff', 'git diff --cached', 'git branch', 'git branch -a',
  'git merge ', 'git stash', 'git stash pop', 'git checkout ',
  'git reset HEAD~1', 'git restore ',
]

function getDefaultSettings(): Settings {
  return {
    commitPrefixes: { global: [...DEFAULT_PREFIXES], projects: {} },
    terminalCommands: { global: [...DEFAULT_COMMANDS], projects: {} },
  }
}

const modalTitle = computed(() => scope.value === 'global' ? '全局设置' : `项目设置 — ${repoStore.currentRepo?.name || ''}`)

watch(() => props.show, async (val) => {
  if (val) {
    await settingsStore.loadSettings()
    loadCurrentScope()
  }
})

function loadCurrentScope() {
  const s = settingsStore.settings ?? getDefaultSettings()
  if (scope.value === 'global') {
    prefixList.value = [...s.commitPrefixes.global]
    commandList.value = [...s.terminalCommands.global]
  } else if (repoPath.value) {
    prefixList.value = [...(s.commitPrefixes.projects[repoPath.value] ?? s.commitPrefixes.global)]
    commandList.value = [...(s.terminalCommands.projects[repoPath.value] ?? s.terminalCommands.global)]
  }
}

watch(scope, () => loadCurrentScope())

function addPrefix() {
  const val = newPrefix.value.trim()
  if (!val) return
  if (prefixList.value.includes(val)) { message.warning('已存在'); return }
  prefixList.value.push(val)
  newPrefix.value = ''
}

function removePrefix(index: number) {
  prefixList.value.splice(index, 1)
}

function resetPrefixes() {
  prefixList.value = [...DEFAULT_PREFIXES]
}

function syncGlobalPrefixes() {
  const count = newGlobalPrefixes.value.length
  prefixList.value = [...prefixList.value, ...newGlobalPrefixes.value]
  message.success(`已同步 ${count} 个全局前缀`)
}

function syncGlobalCommands() {
  const count = newGlobalCommands.value.length
  commandList.value = [...commandList.value, ...newGlobalCommands.value]
  message.success(`已同步 ${count} 个全局命令`)
}

function addCommand() {
  const val = newCommand.value.trim()
  if (!val) return
  if (commandList.value.includes(val)) { message.warning('已存在'); return }
  commandList.value.push(val)
  newCommand.value = ''
}

function removeCommand(index: number) {
  commandList.value.splice(index, 1)
}

function resetCommands() {
  commandList.value = [...DEFAULT_COMMANDS]
}

async function handleSave() {
  saving.value = true
  try {
    const s = settingsStore.settings ?? getDefaultSettings()
    const updated: Settings = {
      commitPrefixes: { ...s.commitPrefixes },
      terminalCommands: { ...s.terminalCommands },
    }
    if (scope.value === 'global') {
      updated.commitPrefixes.global = [...prefixList.value]
      updated.terminalCommands.global = [...commandList.value]
    } else if (repoPath.value) {
      updated.commitPrefixes.projects = { ...s.commitPrefixes.projects, [repoPath.value]: [...prefixList.value] }
      updated.terminalCommands.projects = { ...s.terminalCommands.projects, [repoPath.value]: [...commandList.value] }
    }
    await settingsStore.saveSettings(updated)
    await settingsStore.loadPrefixes(repoPath.value)
    await settingsStore.loadTerminalCommands(repoPath.value)
    message.success('设置已保存')
    emit('update:show', false)
  } catch (e: any) {
    message.error('保存失败: ' + (e.message || String(e)))
  } finally {
    saving.value = false
  }
}

function handleClose() {
  emit('update:show', false)
}
</script>

<template>
  <NModal :show="show" @update:show="handleClose" preset="card" :title="modalTitle" style="width: 520px" :bordered="false" :mask-closable="false">
    <div class="scope-switch">
      <NRadioGroup v-model:value="scope" size="small">
        <NRadio value="global">全局</NRadio>
        <NRadio value="project" :disabled="!repoPath">当前项目</NRadio>
      </NRadioGroup>
    </div>

    <!-- Commit Prefixes -->
    <div class="section">
      <div class="section-header">
        <span class="section-title">提交前缀</span>
        <NButton text size="tiny" @click="resetPrefixes">恢复默认</NButton>
      </div>
      <NAlert v-if="newGlobalPrefixes.length > 0" type="info" :show-icon="false" class="sync-alert">
        全局有 {{ newGlobalPrefixes.length }} 个新前缀：
        <NTag v-for="p in newGlobalPrefixes" :key="p" size="tiny" type="info" class="sync-tag">{{ p }}</NTag>
        <NButton text type="primary" size="tiny" @click="syncGlobalPrefixes">同步</NButton>
      </NAlert>
      <draggable v-model="prefixList" :item-key="(item: string) => item" handle=".drag-handle" class="tag-list" ghost-class="drag-ghost">
        <template #item="{ element, index }">
          <NTag size="small" closable @close="removePrefix(index)" class="draggable-tag">
            <span class="drag-handle">⠿</span>
            {{ element }}
          </NTag>
        </template>
      </draggable>
      <span v-if="prefixList.length === 0" class="empty-hint">无自定义前缀</span>
      <div class="add-row">
        <NInput v-model:value="newPrefix" size="small" placeholder="输入新前缀" @keydown.enter="addPrefix" style="flex:1" />
        <NButton size="small" @click="addPrefix">添加</NButton>
      </div>
    </div>

    <!-- Terminal Commands -->
    <div class="section">
      <div class="section-header">
        <span class="section-title">终端命令</span>
        <NButton text size="tiny" @click="resetCommands">恢复默认</NButton>
      </div>
      <NAlert v-if="newGlobalCommands.length > 0" type="info" :show-icon="false" class="sync-alert">
        全局有 {{ newGlobalCommands.length }} 个新命令：
        <NTag v-for="c in newGlobalCommands" :key="c" size="tiny" type="info" class="sync-tag">{{ c }}</NTag>
        <NButton text type="primary" size="tiny" @click="syncGlobalCommands">同步</NButton>
      </NAlert>
      <draggable v-model="commandList" :item-key="(item: string) => item" handle=".drag-handle" class="tag-list" ghost-class="drag-ghost">
        <template #item="{ element, index }">
          <NTag size="small" closable @close="removeCommand(index)" class="draggable-tag">
            <span class="drag-handle">⠿</span>
            {{ element }}
          </NTag>
        </template>
      </draggable>
      <span v-if="commandList.length === 0" class="empty-hint">无自定义命令</span>
      <div class="add-row">
        <NInput v-model:value="newCommand" size="small" placeholder="输入新命令" @keydown.enter="addCommand" style="flex:1" />
        <NButton size="small" @click="addCommand">添加</NButton>
      </div>
    </div>

    <template #action>
      <div class="modal-actions">
        <NButton @click="handleClose" :disabled="saving">取消</NButton>
        <NButton type="primary" :loading="saving" @click="handleSave">保存</NButton>
      </div>
    </template>
  </NModal>
</template>

<style scoped>
.scope-switch {
  margin-bottom: 20px;
}

.section {
  margin-bottom: 24px;
}

.section:last-child {
  margin-bottom: 0;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
  min-height: 28px;
}

.draggable-tag {
  cursor: default;
}

.drag-handle {
  cursor: grab;
  margin-right: 4px;
  color: var(--text-muted);
  user-select: none;
}

.drag-handle:active {
  cursor: grabbing;
}

.drag-ghost {
  opacity: 0.5;
}

.empty-hint {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 28px;
}

.add-row {
  display: flex;
  gap: 8px;
}

.sync-alert {
  margin-bottom: 10px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.sync-tag {
  margin: 0;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
