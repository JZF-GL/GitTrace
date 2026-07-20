<script setup lang="ts">
import { onMounted } from 'vue'
import { NConfigProvider, NMessageProvider, NDialogProvider, darkTheme } from 'naive-ui'
import { useRepositoryStore } from './stores/repository'
import MainView from './views/MainView.vue'
import './styles/dark-theme.css'

const repoStore = useRepositoryStore()

onMounted(async () => {
  await repoStore.loadRepos()
  if (repoStore.repos.length > 0 && !repoStore.currentRepo) {
    repoStore.selectRepo(repoStore.repos[0])
  }
})
</script>

<template>
  <NConfigProvider :theme="darkTheme">
    <NMessageProvider>
      <NDialogProvider>
        <MainView />
      </NDialogProvider>
    </NMessageProvider>
  </NConfigProvider>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #0d1117;
  color: #c9d1d9;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
}
</style>
