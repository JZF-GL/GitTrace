<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { NModal, NButton, NSpace, useMessage } from 'naive-ui'

const props = defineProps<{
  show: boolean
  repoPath: string
  filePath: string
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'resolved'): void
}>()

const message = useMessage()
const loading = ref(false)
const saving = ref(false)

interface ConflictBlock {
  id: number
  oursLines: string[]
  theirsLines: string[]
  startMarker: string
  separatorLine: string
  endMarker: string
  // 用户在三方界面对此冲突的选择: 'none' (未选) | 'ours' | 'theirs'
  decision: 'none' | 'ours' | 'theirs'
}

interface CommonChunk {
  type: 'common'
  lines: string[]
}

interface ConflictChunk {
  type: 'conflict'
  block: ConflictBlock
}

type ChunkItem = CommonChunk | ConflictChunk

const chunks = ref<ChunkItem[]>([])
const mergedText = ref('')
const isManualEdited = ref(false)

// 从工作区冲突文件中解析出所有的 common 块与 conflict 块
function parseConflictContent(content: string): ChunkItem[] {
  const lines = content.split('\n')
  const result: ChunkItem[] = []
  let commonLines: string[] = []

  let state: 'normal' | 'ours' | 'theirs' = 'normal'
  let currentBlock: ConflictBlock | null = null
  let blockCounter = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.startsWith('<<<<<<<')) {
      if (commonLines.length > 0) {
        result.push({
          type: 'common',
          lines: commonLines,
        })
        commonLines = []
      }
      state = 'ours'
      currentBlock = {
        id: ++blockCounter,
        oursLines: [],
        theirsLines: [],
        startMarker: line,
        separatorLine: '=======',
        endMarker: '>>>>>>>',
        decision: 'none',
      }
    } else if (line.startsWith('=======')) {
      if (state === 'ours' && currentBlock) {
        currentBlock.separatorLine = line
        state = 'theirs'
      } else {
        if (state === 'normal') {
          commonLines.push(line)
        } else if (state === 'theirs' && currentBlock) {
          currentBlock.theirsLines.push(line)
        }
      }
    } else if (line.startsWith('>>>>>>>')) {
      if (state === 'theirs' && currentBlock) {
        currentBlock.endMarker = line
        result.push({
          type: 'conflict',
          block: currentBlock,
        })
        currentBlock = null
        state = 'normal'
      } else {
        if (state === 'normal') {
          commonLines.push(line)
        } else if (state === 'ours' && currentBlock) {
          currentBlock.oursLines.push(line)
        }
      }
    } else {
      if (state === 'normal') {
        commonLines.push(line)
      } else if (state === 'ours' && currentBlock) {
        currentBlock.oursLines.push(line)
      } else if (state === 'theirs' && currentBlock) {
        currentBlock.theirsLines.push(line)
      }
    }
  }

  if (commonLines.length > 0) {
    result.push({
      type: 'common',
      lines: commonLines,
    })
  }

  return result
}

// 根据 chunks 与各冲突块的 decision，生成中间编辑器的文本
function generateMergedContent(): string {
  const lines: string[] = []
  for (const chunk of chunks.value) {
    if (chunk.type === 'common') {
      lines.push(...chunk.lines)
    } else if (chunk.type === 'conflict') {
      const b = chunk.block
      if (b.decision === 'ours') {
        lines.push(...b.oursLines)
      } else if (b.decision === 'theirs') {
        lines.push(...b.theirsLines)
      } else {
        // 未决时，保留冲突标记，方便用户查看与手工合并
        lines.push(b.startMarker)
        lines.push(...b.oursLines)
        lines.push(b.separatorLine)
        lines.push(...b.theirsLines)
        lines.push(b.endMarker)
      }
    }
  }
  return lines.join('\n')
}

async function loadContent() {
  if (!props.filePath || !props.repoPath) return
  loading.value = true
  isManualEdited.value = false
  try {
    const res = await window.electronAPI.git.conflictFile(props.repoPath, props.filePath)
    const working = res.working || ''
    chunks.value = parseConflictContent(working)
    mergedText.value = generateMergedContent()
  } catch (e: any) {
    message.error('加载冲突文件失败: ' + (e.message || String(e)))
  } finally {
    loading.value = false
  }
}

watch(() => [props.show, props.filePath], ([show, filePath]) => {
  if (show && filePath) {
    loadContent()
  }
}, { immediate: true })

// 点击左边箭头：使用当前冲突代码 -> 中间
function useOursBlock(block: ConflictBlock) {
  block.decision = 'ours'
  mergedText.value = generateMergedContent()
  isManualEdited.value = false
}

// 点击右边箭头：使用引入冲突代码 -> 中间
function useTheirsBlock(block: ConflictBlock) {
  block.decision = 'theirs'
  mergedText.value = generateMergedContent()
  isManualEdited.value = false
}

// 全部使用当前
function useAllOurs() {
  for (const chunk of chunks.value) {
    if (chunk.type === 'conflict') {
      chunk.block.decision = 'ours'
    }
  }
  mergedText.value = generateMergedContent()
  isManualEdited.value = false
}

// 全部使用引入
function useAllTheirs() {
  for (const chunk of chunks.value) {
    if (chunk.type === 'conflict') {
      chunk.block.decision = 'theirs'
    }
  }
  mergedText.value = generateMergedContent()
  isManualEdited.value = false
}

function handleManualInput() {
  isManualEdited.value = true
}

const conflictBlocks = computed(() => {
  return chunks.value.filter((c): c is ConflictChunk => c.type === 'conflict').map(c => c.block)
})

const unhandledCount = computed(() => {
  if (isManualEdited.value) {
    // 如果用户手动修改了，根据文本中是否含有未处理冲突标记来计算
    const lines = mergedText.value.split('\n')
    let c = 0
    for (const l of lines) {
      if (l.startsWith('<<<<<<<')) c++
    }
    return c
  }
  return conflictBlocks.value.filter(b => b.decision === 'none').length
})

async function saveResolution() {
  if (!props.repoPath || !props.filePath) return
  if (unhandledCount.value > 0) {
    message.warning(`当前文件仍有 ${unhandledCount.value} 处未解决的冲突标记，请先处理完或手动清除标记后再保存`)
    return
  }

  saving.value = true
  try {
    const res = await window.electronAPI.git.resolveConflict(props.repoPath, props.filePath, mergedText.value)
    if (res.success) {
      message.success('冲突已成功解决并保存')
      emit('resolved')
      emit('update:show', false)
    } else {
      message.error(res.message || '保存失败')
    }
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
  <NModal
    :show="show"
    preset="card"
    :title="'高级解决冲突 (三方对比)：' + filePath"
    style="width: 96vw; max-width: 1560px; height: 90vh; display: flex; flex-direction: column;"
    content-style="flex: 1; min-height: 0; padding: 0; display: flex; flex-direction: column;"
    @update:show="handleClose"
  >
    <!-- 顶部操作条 -->
    <div class="modal-top-bar">
      <div class="conflict-summary">
        <span
          class="status-badge"
          :class="{ 'badge-warning': unhandledCount > 0, 'badge-success': unhandledCount === 0 }"
        >
          {{ unhandledCount > 0 ? `待处理冲突: ${unhandledCount} 处` : '所有冲突已处理完毕' }}
        </span>
        <span class="tip-text">
          提示：点击冲突旁边的箭头可将相应版本填入中间；中间文件支持直接编辑修改。
        </span>
      </div>
      <NSpace size="small">
        <NButton size="small" @click="useAllOurs" :disabled="conflictBlocks.length === 0">全部使用当前</NButton>
        <NButton size="small" @click="useAllTheirs" :disabled="conflictBlocks.length === 0">全部使用引入</NButton>
        <NButton size="small" type="primary" :loading="saving" @click="saveResolution">
          保存并标记已解决
        </NButton>
      </NSpace>
    </div>

    <!-- 左中右三部分 -->
    <div class="three-way-container">
      <!-- 左栏：当前文件 (HEAD / 本地更改) -->
      <div class="column-pane left-pane">
        <div class="pane-titlebar">
          <span class="pane-title">当前更改 (本地 / HEAD)</span>
          <span class="pane-sub">代码左侧为基准</span>
        </div>
        <div class="pane-body">
          <template v-for="(chunk, idx) in chunks" :key="'left-' + idx">
            <!-- 共有行 -->
            <div v-if="chunk.type === 'common'" class="code-block common-block">
              <div v-for="(line, lIdx) in chunk.lines" :key="'l-c-' + lIdx" class="code-line">
                <span class="line-content">{{ line || ' ' }}</span>
              </div>
            </div>
            <!-- 冲突行：显示当前冲突代码，右侧带有箭头按钮 -->
            <div
              v-else-if="chunk.type === 'conflict'"
              class="code-block conflict-block ours-block"
              :class="{ chosen: chunk.block.decision === 'ours' }"
            >
              <div class="block-bar">
                <span class="badge ours-badge">当前代码 #{{ chunk.block.id }}</span>
                <button
                  class="arrow-btn to-right"
                  @click="useOursBlock(chunk.block)"
                  title="使用当前冲突代码"
                >
                  <span class="btn-text">使用当前</span>
                  <span class="arrow-icon">&rarr;</span>
                </button>
              </div>
              <div class="block-code-lines">
                <div v-if="chunk.block.oursLines.length === 0" class="code-line empty-line">&lt;空更改&gt;</div>
                <div v-for="(line, lIdx) in chunk.block.oursLines" :key="'l-o-' + lIdx" class="code-line ours-line">
                  <span class="line-content">{{ line || ' ' }}</span>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- 中栏：合并后的效果 (可自由编辑修改代码) -->
      <div class="column-pane center-pane">
        <div class="pane-titlebar center-titlebar">
          <span class="pane-title">合并结果 (最终文件内容)</span>
          <span class="center-tag">支持自由编辑修改</span>
        </div>
        <div class="pane-body center-body">
          <textarea
            v-model="mergedText"
            class="editor-textarea"
            placeholder="合并后的文件内容..."
            spellcheck="false"
            @input="handleManualInput"
          />
        </div>
      </div>

      <!-- 右栏：引入的文件 (MERGE_HEAD / 传入更改) -->
      <div class="column-pane right-pane">
        <div class="pane-titlebar">
          <span class="pane-title">传入更改 (引入 / MERGE_HEAD)</span>
          <span class="pane-sub">合并进来的版本</span>
        </div>
        <div class="pane-body">
          <template v-for="(chunk, idx) in chunks" :key="'right-' + idx">
            <!-- 共有行 -->
            <div v-if="chunk.type === 'common'" class="code-block common-block">
              <div v-for="(line, lIdx) in chunk.lines" :key="'r-c-' + lIdx" class="code-line">
                <span class="line-content">{{ line || ' ' }}</span>
              </div>
            </div>
            <!-- 冲突行：显示引入冲突代码，左侧带有箭头按钮 -->
            <div
              v-else-if="chunk.type === 'conflict'"
              class="code-block conflict-block theirs-block"
              :class="{ chosen: chunk.block.decision === 'theirs' }"
            >
              <div class="block-bar right-bar">
                <button
                  class="arrow-btn to-left"
                  @click="useTheirsBlock(chunk.block)"
                  title="使用传入冲突代码"
                >
                  <span class="arrow-icon">&larr;</span>
                  <span class="btn-text">使用传入</span>
                </button>
                <span class="badge theirs-badge">传入代码 #{{ chunk.block.id }}</span>
              </div>
              <div class="block-code-lines">
                <div v-if="chunk.block.theirsLines.length === 0" class="code-line empty-line">&lt;空更改&gt;</div>
                <div v-for="(line, lIdx) in chunk.block.theirsLines" :key="'r-t-' + lIdx" class="code-line theirs-line">
                  <span class="line-content">{{ line || ' ' }}</span>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </NModal>
</template>

<style scoped>
.modal-top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.conflict-summary {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-badge {
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 12px;
  font-weight: 600;
}

.badge-warning {
  background: rgba(210, 153, 34, 0.2);
  color: var(--accent-orange);
  border: 1px solid rgba(210, 153, 34, 0.4);
}

.badge-success {
  background: rgba(63, 185, 80, 0.2);
  color: var(--accent-green);
  border: 1px solid rgba(63, 185, 80, 0.4);
}

.tip-text {
  font-size: 12px;
  color: var(--text-muted);
}

.three-way-container {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

.column-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  border-right: 1px solid var(--border-color);
  background: var(--bg-primary);
}

.right-pane {
  border-right: none;
}

.pane-titlebar {
  height: 36px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.center-titlebar {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.pane-sub {
  font-size: 11px;
  font-weight: normal;
  color: var(--text-muted);
}

.center-tag {
  font-size: 11px;
  color: var(--accent-blue);
  background: rgba(88, 166, 255, 0.15);
  padding: 2px 6px;
  border-radius: 4px;
}

.pane-body {
  flex: 1;
  overflow: auto;
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
  font-size: 12px;
  line-height: 20px;
  background: var(--bg-primary);
}

.center-body {
  display: flex;
  flex-direction: column;
}

.code-block {
  width: 100%;
}

.code-line {
  padding: 0 10px;
  white-space: pre-wrap;
  word-break: break-all;
  min-height: 20px;
  box-sizing: border-box;
}

.common-block .code-line {
  color: var(--text-primary);
}

.empty-line {
  color: var(--text-muted);
  font-style: italic;
  padding: 4px 10px;
}

/* 冲突卡片 */
.conflict-block {
  margin: 6px 4px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  overflow: hidden;
  transition: all 0.2s;
}

.ours-block {
  background: rgba(63, 185, 80, 0.05);
  border-color: rgba(63, 185, 80, 0.3);
}

.ours-block.chosen {
  border-color: var(--accent-green);
  box-shadow: 0 0 0 1px var(--accent-green);
}

.theirs-block {
  background: rgba(248, 81, 73, 0.05);
  border-color: rgba(248, 81, 73, 0.3);
}

.theirs-block.chosen {
  border-color: var(--accent-red);
  box-shadow: 0 0 0 1px var(--accent-red);
}

.block-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  background: rgba(0, 0, 0, 0.25);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.block-bar.right-bar {
  justify-content: space-between;
}

.badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
}

.ours-badge {
  color: #7ee787;
  background: rgba(63, 185, 80, 0.2);
}

.theirs-badge {
  color: #ffa198;
  background: rgba(248, 81, 73, 0.2);
}

/* 箭头按钮 */
.arrow-btn {
  border: none;
  cursor: pointer;
  border-radius: 4px;
  padding: 2px 10px;
  font-size: 11px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all 0.15s;
}

.to-right {
  background: var(--accent-green);
  color: #fff;
}

.to-right:hover {
  filter: brightness(1.2);
  transform: translateX(2px);
}

.to-left {
  background: var(--accent-red);
  color: #fff;
}

.to-left:hover {
  filter: brightness(1.2);
  transform: translateX(-2px);
}

.arrow-icon {
  font-size: 13px;
  font-weight: bold;
}

.block-code-lines {
  padding: 4px 0;
}

.ours-line {
  color: #7ee787;
  background: rgba(63, 185, 80, 0.12);
}

.theirs-line {
  color: #ffa198;
  background: rgba(248, 81, 73, 0.12);
}

/* 中间文本框 */
.editor-textarea {
  flex: 1;
  width: 100%;
  height: 100%;
  border: none;
  outline: none;
  resize: none;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
  font-size: 12px;
  line-height: 20px;
  padding: 10px 12px;
  box-sizing: border-box;
  tab-size: 2;
  white-space: pre;
}
</style>
