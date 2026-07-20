<script setup lang="ts">
import { computed } from 'vue'
import { format } from 'date-fns'
import type { GraphCommit } from '../../stores/commits'

const props = defineProps<{
  commit: GraphCommit
}>()

const formattedDate = computed(() => {
  try {
    return format(new Date(props.commit.date), 'yyyy-MM-dd HH:mm:ss')
  } catch {
    return props.commit.date
  }
})
</script>

<template>
  <div class="commit-detail">
    <h3 class="detail-title">{{ commit.message }}</h3>
    <div class="detail-meta">
      <div class="meta-row">
        <span class="meta-label">提交</span>
        <span class="meta-value hash">{{ commit.hash }}</span>
      </div>
      <div class="meta-row">
        <span class="meta-label">作者</span>
        <span class="meta-value">{{ commit.author }}</span>
      </div>
      <div class="meta-row">
        <span class="meta-label">时间</span>
        <span class="meta-value">{{ formattedDate }}</span>
      </div>
      <div v-if="commit.parentHashes.length > 0" class="meta-row">
        <span class="meta-label">父提交</span>
        <div class="parent-list">
          <span v-for="parent in commit.parentHashes" :key="parent" class="parent-hash">
            {{ parent.substring(0, 7) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.commit-detail {
  max-width: 100%;
}

.detail-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 16px;
  line-height: 1.4;
  word-break: break-word;
}

.detail-meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.meta-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.meta-label {
  font-size: 12px;
  color: var(--text-muted);
  min-width: 60px;
  text-align: right;
  padding-top: 2px;
}

.meta-value {
  font-size: 13px;
  color: var(--text-primary);
}

.hash {
  font-family: 'SF Mono', 'Menlo', 'Monaco', monospace;
  color: var(--accent-blue);
}

.parent-list {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.parent-hash {
  font-family: 'SF Mono', 'Menlo', 'Monaco', monospace;
  font-size: 12px;
  color: var(--accent-purple);
  background: rgba(188, 140, 255, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
}
</style>
