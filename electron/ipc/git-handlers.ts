import { ipcMain } from 'electron'
import * as gitService from '../services/git-service'

export function registerGitHandlers() {
  ipcMain.handle('git:status', async (_event, repoPath: string) => {
    return gitService.getStatus(repoPath)
  })

  ipcMain.handle('git:log', async (_event, repoPath: string, options?: any) => {
    return gitService.getLog(repoPath, options)
  })

  ipcMain.handle('git:log-graph', async (_event, repoPath: string, maxCount?: number) => {
    return gitService.getLogGraph(repoPath, maxCount)
  })

  ipcMain.handle('git:diff', async (_event, repoPath: string, file?: string) => {
    return gitService.getDiff(repoPath, file)
  })

  ipcMain.handle('git:diff-index', async (_event, repoPath: string) => {
    return gitService.getDiffIndex(repoPath)
  })

  ipcMain.handle('git:diff-staged', async (_event, repoPath: string) => {
    return gitService.getDiffStaged(repoPath)
  })

  ipcMain.handle('git:add', async (_event, repoPath: string, files: string[]) => {
    return gitService.addFiles(repoPath, files)
  })

  ipcMain.handle('git:add-all', async (_event, repoPath: string) => {
    return gitService.addAll(repoPath)
  })

  ipcMain.handle('git:reset', async (_event, repoPath: string, files: string[]) => {
    return gitService.resetFiles(repoPath, files)
  })

  ipcMain.handle('git:commit', async (_event, repoPath: string, message: string) => {
    return gitService.commit(repoPath, message)
  })

  ipcMain.handle('git:push', async (_event, repoPath: string, remote?: string, branch?: string) => {
    return gitService.push(repoPath, remote, branch)
  })

  ipcMain.handle('git:pull', async (_event, repoPath: string, remote?: string, branch?: string) => {
    return gitService.pull(repoPath, remote, branch)
  })

  ipcMain.handle('git:fetch', async (_event, repoPath: string, remote?: string) => {
    return gitService.fetch(repoPath, remote)
  })

  ipcMain.handle('git:branch-list', async (_event, repoPath: string) => {
    console.log('[IPC] git:branch-list called for:', repoPath)
    const result = await gitService.branchList(repoPath)
    console.log('[IPC] git:branch-list result:', JSON.stringify(result))
    return result
  })

  ipcMain.handle('git:branch-create', async (_event, repoPath: string, branchName: string, startPoint?: string) => {
    return gitService.branchCreate(repoPath, branchName, startPoint)
  })

  ipcMain.handle('git:branch-delete', async (_event, repoPath: string, branchName: string, force?: boolean) => {
    return gitService.branchDelete(repoPath, branchName, force)
  })

  ipcMain.handle('git:checkout', async (_event, repoPath: string, branch: string) => {
    return gitService.checkout(repoPath, branch)
  })

  ipcMain.handle('git:merge', async (_event, repoPath: string, branch: string) => {
    return gitService.merge(repoPath, branch)
  })

  ipcMain.handle('git:rebase', async (_event, repoPath: string, branch: string) => {
    return gitService.rebase(repoPath, branch)
  })

  ipcMain.handle('git:stash-list', async (_event, repoPath: string) => {
    return gitService.stashList(repoPath)
  })

  ipcMain.handle('git:stash-push', async (_event, repoPath: string, message?: string) => {
    return gitService.stashPush(repoPath, message)
  })

  ipcMain.handle('git:stash-pop', async (_event, repoPath: string) => {
    return gitService.stashPop(repoPath)
  })

  ipcMain.handle('git:stash-drop', async (_event, repoPath: string, stashRef: string) => {
    return gitService.stashDrop(repoPath, stashRef)
  })

  ipcMain.handle('git:tag-list', async (_event, repoPath: string) => {
    return gitService.tagList(repoPath)
  })

  ipcMain.handle('git:tag-create', async (_event, repoPath: string, tagName: string, ref?: string) => {
    return gitService.tagCreate(repoPath, tagName, ref)
  })

  ipcMain.handle('git:tag-delete', async (_event, repoPath: string, tagName: string) => {
    return gitService.tagDelete(repoPath, tagName)
  })

  ipcMain.handle('git:remote-list', async (_event, repoPath: string) => {
    return gitService.remoteList(repoPath)
  })

  ipcMain.handle('git:remote-add', async (_event, repoPath: string, name: string, url: string) => {
    return gitService.remoteAdd(repoPath, name, url)
  })

  ipcMain.handle('git:remote-remove', async (_event, repoPath: string, name: string) => {
    return gitService.remoteRemove(repoPath, name)
  })

  ipcMain.handle('git:config', async (_event, repoPath: string) => {
    return gitService.getConfig(repoPath)
  })
}
