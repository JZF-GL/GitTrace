import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAppStore = defineStore('app', () => {
  const activeTab = ref('history')

  function setActiveTab(tab: string) {
    activeTab.value = tab
  }

  return { activeTab, setActiveTab }
})
