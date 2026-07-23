import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useTerminalStore = defineStore('terminal', () => {
  const history = ref<string[]>([])
  const commandHistory = ref<string[]>([])

  function addHistory(line: string) {
    history.value.push(line)
  }

  function addCommandHistory(cmd: string) {
    commandHistory.value.push(cmd)
  }

  function clearHistory() {
    history.value = []
  }

  return { history, commandHistory, addHistory, addCommandHistory, clearHistory }
})
