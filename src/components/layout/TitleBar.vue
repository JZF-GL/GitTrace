<script setup lang="ts">
function minimize() { window.electronAPI.window.minimize() }
function maximize() { window.electronAPI.window.maximize() }
function close() { window.electronAPI.window.close() }
</script>

<template>
  <div class="titlebar">
    <div class="titlebar-title">
      <span class="titlebar-icon">&#9670;</span>
      GitTrace
    </div>
    <div class="titlebar-spacer" />
    <div class="titlebar-controls">
      <button class="titlebar-btn" @click="minimize">&#9472;</button>
      <button class="titlebar-btn" @click="maximize">&#9723;</button>
      <button class="titlebar-btn close-btn" @click="close">&#10005;</button>
    </div>
  </div>
</template>

<style scoped>
.titlebar-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.titlebar-icon {
  color: var(--accent-purple);
  font-size: 14px;
}

.titlebar-spacer {
  flex: 1;
}

.titlebar-controls {
  display: flex;
  gap: 2px;
}

.close-btn:hover {
  background: #e81123 !important;
  color: white !important;
}
</style>
