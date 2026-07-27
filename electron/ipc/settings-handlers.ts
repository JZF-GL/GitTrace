import { ipcMain } from 'electron'
import * as settingsService from '../services/settings'

export function registerSettingsHandlers() {
  ipcMain.handle('settings:get', async () => {
    return settingsService.getSettings()
  })

  ipcMain.handle('settings:save', async (_event, settings: settingsService.Settings) => {
    settingsService.saveSettings(settings)
  })

  ipcMain.handle('settings:get-commit-prefixes', async (_event, repoPath?: string) => {
    return settingsService.getCommitPrefixes(repoPath)
  })

  ipcMain.handle('settings:get-terminal-commands', async (_event, repoPath?: string) => {
    return settingsService.getTerminalCommands(repoPath)
  })
}
