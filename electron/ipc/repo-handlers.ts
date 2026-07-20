import { ipcMain } from 'electron'
import { repoManager } from '../services/repo-manager'

export function registerRepoHandlers() {
  ipcMain.handle('repo:add', async (_event, path: string) => {
    return repoManager.add(path)
  })

  ipcMain.handle('repo:list', async () => {
    return repoManager.list()
  })

  ipcMain.handle('repo:remove', async (_event, id: string) => {
    return repoManager.remove(id)
  })
}
