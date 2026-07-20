<script setup lang="ts">
import { ref, watch } from 'vue'
import { NSpin } from 'naive-ui'

const props = defineProps<{
  repoPath: string
  filePath: string
}>()

const diff = ref('')
const loading = ref(false)

watch(() => props.filePath, async () => {
  if (!props.filePath) {
    diff.value = ''
    return
  }
  loading.value = true
  try {
    diff.value = await window.electronAPI.git.diff(props.repoPath, props.filePath)
  } finally {
    loading.value = false
  }
}, { immediate: true })

function getDiffLines(text: string) {
  return text.split('\n').map(line => {
    if (line.startsWith('+') && !line.startsWith('+++')) return { type: 'add', text: line }
    if (line.startsWith('-') && !line.startsWith('---')) return { type: 'remove', text: line }
    if (line.startsWith('@@')) return { type: 'hunk', text: line }
    if (line.startsWith('diff --git') || line.startsWith('index ') || line.startsWith('---') || line.startsWith('+++')) {
      return { type: 'header', text: line }
    }
    return { type: 'normal', text: line }
  })
}
</script>

<template>
  <div class="diff-viewer">
    <div class="diff-header">
      <span class="diff-file">{{ filePath }}</span>
    </div>
    <div class="diff-content" v-if="!loading">
      <pre class="diff-pre"><template v-for="(line, i) in getDiffLines(diff)" :key="i"><span :class="'diff-line diff-' + line.type">{{ line.text }}</span>
</template></pre>
    </div>
    <div v-else class="diff-loading">
      <NSpin size="medium" />
    </div>
  </div>
</template>

<style scoped>
.diff-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.diff-header {
  padding: 8px 16px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}

.diff-file {
  font-family: 'SF Mono', monospace;
  font-size: 12px;
  color: var(--text-secondary);
}

.diff-content {
  flex: 1;
  overflow: auto;
}

.diff-pre {
  margin: 0;
  padding: 8px 0;
  font-family: 'SF Mono', 'Menlo', 'Monaco', monospace;
  font-size: 12px;
  line-height: 1.6;
}

.diff-line {
  display: block;
  padding: 0 16px;
  white-space: pre-wrap;
  word-break: break-all;
}

.diff-add {
  background: rgba(63, 185, 80, 0.1);
  color: var(--accent-green);
}

.diff-remove {
  background: rgba(248, 81, 73, 0.1);
  color: var(--accent-red);
}

.diff-hunk {
  background: rgba(188, 140, 255, 0.1);
  color: var(--accent-purple);
}

.diff-header {
  color: var(--text-muted);
}

.diff-normal {
  color: var(--text-primary);
}

.diff-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}
</style>
