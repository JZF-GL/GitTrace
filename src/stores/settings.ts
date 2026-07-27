import { defineStore } from 'pinia'
import { ref, toRaw } from 'vue'

export interface Settings {
  commitPrefixes: {
    global: string[]
    projects: Record<string, string[]>
  }
  terminalCommands: {
    global: string[]
    projects: Record<string, string[]>
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<Settings | null>(null)
  const commitPrefixes = ref<string[]>([])
  const terminalCommands = ref<string[]>([])

  async function loadSettings() {
    settings.value = await window.electronAPI.settings.get()
  }

  async function saveSettings(s: Settings) {
    await window.electronAPI.settings.save(JSON.parse(JSON.stringify(toRaw(s))))
    settings.value = s
  }

  async function loadPrefixes(repoPath?: string) {
    commitPrefixes.value = await window.electronAPI.settings.getCommitPrefixes(repoPath)
  }

  async function loadTerminalCommands(repoPath?: string) {
    terminalCommands.value = await window.electronAPI.settings.getTerminalCommands(repoPath)
  }

  return { settings, commitPrefixes, terminalCommands, loadSettings, saveSettings, loadPrefixes, loadTerminalCommands }
})
