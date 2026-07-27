import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAppStore = defineStore('app', () => {
  const activeTab = ref('history')
  const sidebarCollapsed = ref(false)

  function setActiveTab(tab: string) {
    activeTab.value = tab
  }

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  return { activeTab, setActiveTab, sidebarCollapsed, toggleSidebar }
})
