<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { NSpin, NEmpty } from 'naive-ui'

const props = defineProps<{
  repoPath: string
  filePath: string
  staged?: boolean
}>()

interface DiffLine {
  type: 'header' | 'hunk' | 'add' | 'remove' | 'normal'
  text: string
  oldLineNum: number | null
  newLineNum: number | null
}

const diff = ref('')
const loading = ref(false)
const error = ref('')

watch(() => [props.filePath, props.staged], async () => {
  if (!props.filePath) {
    diff.value = ''
    return
  }
  loading.value = true
  error.value = ''
  try {
    // For unstaged files use diff, for staged files use diff --cached
    if (props.staged) {
      diff.value = await window.electronAPI.git.diffStaged(props.repoPath, props.filePath)
    } else {
      diff.value = await window.electronAPI.git.diff(props.repoPath, props.filePath)
    }
  } catch (e: any) {
    error.value = e.message || '加载 diff 失败'
  } finally {
    loading.value = false
  }
}, { immediate: true })

const stats = computed(() => {
  const lines = diff.value.split('\n')
  let additions = 0
  let deletions = 0
  for (const line of lines) {
    if (line.startsWith('+') && !line.startsWith('+++')) additions++
    else if (line.startsWith('-') && !line.startsWith('---')) deletions++
  }
  return { additions, deletions }
})

const parsedLines = computed(() => {
  const lines = diff.value.split('\n')
  const result: DiffLine[] = []
  let oldLine = 0
  let newLine = 0

  for (const raw of lines) {
    if (raw.startsWith('diff --git') || raw.startsWith('index ') || raw.startsWith('---') || raw.startsWith('+++')) {
      result.push({ type: 'header', text: raw, oldLineNum: null, newLineNum: null })
    } else if (raw.startsWith('@@')) {
      // Parse hunk header to get line numbers
      const match = raw.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
      if (match) {
        oldLine = parseInt(match[1])
        newLine = parseInt(match[2])
      }
      result.push({ type: 'hunk', text: raw, oldLineNum: null, newLineNum: null })
    } else if (raw.startsWith('+') && !raw.startsWith('+++')) {
      result.push({ type: 'add', text: raw, oldLineNum: null, newLineNum: newLine })
      newLine++
    } else if (raw.startsWith('-') && !raw.startsWith('---')) {
      result.push({ type: 'remove', text: raw, oldLineNum: oldLine, newLineNum: null })
      oldLine++
    } else {
      result.push({ type: 'normal', text: raw, oldLineNum: oldLine, newLineNum: newLine })
      oldLine++
      newLine++
    }
  }
  return result
})
</script>

<template>
  <div class="diff-viewer">
    <!-- Header -->
    <div class="diff-header">
      <span class="diff-file">{{ filePath }}</span>
      <span class="diff-stats" v-if="stats.additions || stats.deletions">
        <span class="stat-add">+{{ stats.additions }}</span>
        <span class="stat-del">-{{ stats.deletions }}</span>
      </span>
    </div>

    <!-- Content -->
    <div class="diff-content" v-if="!loading && !error">
      <NEmpty v-if="parsedLines.length === 0" description="没有变更" />
      <table v-else class="diff-table">
        <tbody>
          <tr
            v-for="(line, i) in parsedLines"
            :key="i"
            :class="'diff-row diff-row-' + line.type"
          >
            <td class="line-num old">{{ line.oldLineNum ?? '' }}</td>
            <td class="line-num new">{{ line.newLineNum ?? '' }}</td>
            <td class="line-prefix">{{ line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' ' }}</td>
            <td class="line-code">{{ line.text.replace(/^[+\- ]/, '') }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Loading -->
    <div v-else-if="loading" class="diff-loading">
      <NSpin size="medium" />
    </div>

    <!-- Error -->
    <div v-else class="diff-error">
      <p>{{ error }}</p>
    </div>
  </div>
</template>

<style scoped>
.diff-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.diff-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 20px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.diff-file {
  font-family: 'Cascadia Code', 'Fira Code', 'SF Mono', monospace;
  font-size: 12px;
  color: var(--text-secondary);
}

.diff-stats {
  display: flex;
  gap: 8px;
  font-size: 12px;
  font-family: monospace;
}

.stat-add {
  color: var(--accent-green);
}

.stat-del {
  color: var(--accent-red);
}

.diff-content {
  flex: 1;
  overflow: auto;
}

.diff-table {
  width: 100%;
  border-collapse: collapse;
  font-family: 'Cascadia Code', 'Fira Code', 'SF Mono', 'Menlo', monospace;
  font-size: 12px;
  line-height: 1.5;
}

.diff-row {
  white-space: pre;
}

.diff-row-header {
  background: var(--bg-tertiary);
}

.diff-row-header .line-code {
  color: var(--text-muted);
}

.diff-row-hunk {
  background: rgba(188, 140, 255, 0.08);
}

.diff-row-hunk .line-code {
  color: var(--accent-purple);
}

.diff-row-add {
  background: rgba(63, 185, 80, 0.12);
}

.diff-row-add .line-code {
  color: #7ee787;
}

.diff-row-remove {
  background: rgba(248, 81, 73, 0.12);
}

.diff-row-remove .line-code {
  color: #ffa198;
}

.diff-row-normal .line-code {
  color: var(--text-primary);
}

.line-num {
  width: 50px;
  padding: 0 8px;
  text-align: right;
  color: var(--text-muted);
  user-select: none;
  border-right: 1px solid var(--border-color);
  vertical-align: top;
}

.line-num.old {
  background: rgba(248, 81, 73, 0.05);
}

.line-num.new {
  background: rgba(63, 185, 80, 0.05);
}

.line-prefix {
  width: 20px;
  padding: 0 4px;
  text-align: center;
  color: var(--text-muted);
  user-select: none;
  vertical-align: top;
}

.diff-row-add .line-prefix {
  color: var(--accent-green);
}

.diff-row-remove .line-prefix {
  color: var(--accent-red);
}

.line-code {
  padding: 0 16px;
  vertical-align: top;
  word-break: break-all;
}

.diff-loading {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.diff-error {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-red);
}
</style>
