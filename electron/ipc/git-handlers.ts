import { ipcMain } from 'electron'
import * as gitService from '../services/git-service'

export function registerGitHandlers() {
  ipcMain.handle('git:status', async (_event, repoPath: string) => {
    console.log('[IPC] git:status called for:', repoPath)
    const result = await gitService.getStatus(repoPath)
    console.log('[IPC] git:status result files count:', result.files?.length)
    return result
  })

  ipcMain.handle('git:log', async (_event, repoPath: string, options?: any) => {
    return gitService.getLog(repoPath, options)
  })

  ipcMain.handle('git:log-graph', async (_event, repoPath: string, maxCount?: number, branch?: string) => {
    return gitService.getLogGraph(repoPath, maxCount, branch)
  })

  ipcMain.handle('git:diff', async (_event, repoPath: string, file?: string) => {
    return gitService.getDiff(repoPath, file)
  })

  ipcMain.handle('git:diff-index', async (_event, repoPath: string) => {
    return gitService.getDiffIndex(repoPath)
  })

  ipcMain.handle('git:diff-staged', async (_event, repoPath: string, file?: string) => {
    return gitService.getDiffStaged(repoPath, file)
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

  ipcMain.handle('git:restore', async (_event, repoPath: string, files: string[]) => {
    return gitService.restoreFiles(repoPath, files)
  })

  ipcMain.handle('git:commit', async (_event, repoPath: string, message: string) => {
    return gitService.commit(repoPath, message)
  })

  ipcMain.handle('git:push', async (_event, repoPath: string, remote?: string, branch?: string, force?: boolean) => {
    return gitService.push(repoPath, remote, branch, force)
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

  ipcMain.handle('git:remote-tracking-commit', async (_event, repoPath: string, branch: string) => {
    return gitService.getRemoteTrackingCommit(repoPath, branch)
  })

  ipcMain.handle('git:remote-commits', async (_event, repoPath: string) => {
    return gitService.getRemoteCommits(repoPath)
  })

  ipcMain.handle('git:branches-ahead-behind', async (_event, repoPath: string) => {
    return gitService.getBranchesAheadBehind(repoPath)
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

  ipcMain.handle('git:stash-list', async (_event, repoPath: string) => {
    return gitService.stashList(repoPath)
  })

  ipcMain.handle('git:stash-push', async (_event, repoPath: string, message?: string, files?: string[]) => {
    return gitService.stashPush(repoPath, message, files)
  })

  ipcMain.handle('git:stash-pop', async (_event, repoPath: string, stashRef?: string) => {
    return gitService.stashPop(repoPath, stashRef)
  })

  ipcMain.handle('git:stash-drop', async (_event, repoPath: string, stashRef: string) => {
    return gitService.stashDrop(repoPath, stashRef)
  })

  ipcMain.handle('git:stash-show-files', async (_event, repoPath: string, stashRef: string) => {
    return gitService.stashShowFiles(repoPath, stashRef)
  })

  ipcMain.handle('git:stash-show-diff', async (_event, repoPath: string, stashRef: string, filePath?: string) => {
    console.log('[IPC] stash-show-diff:', { stashRef, filePath })
    const result = await gitService.stashShowDiff(repoPath, stashRef, filePath)
    console.log('[IPC] stash-show-diff result length:', result?.length)
    return result
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

  // P0: 撤销提交
  ipcMain.handle('git:reset-commit', async (_event, repoPath: string, commitHash: string, mode: 'soft' | 'mixed' | 'hard') => {
    console.log('[IPC] git:reset-commit called:', { repoPath, commitHash, mode })
    return gitService.resetCommit(repoPath, commitHash, mode)
  })

  // P0: Amend 提交
  ipcMain.handle('git:amend-commit', async (_event, repoPath: string, message: string) => {
    return gitService.amendCommit(repoPath, message)
  })

  // P0: Cherry-pick
  ipcMain.handle('git:cherry-pick', async (_event, repoPath: string, commitHash: string) => {
    return gitService.cherryPick(repoPath, commitHash)
  })

  // P0: Rebase
  ipcMain.handle('git:rebase', async (_event, repoPath: string, branch: string) => {
    return gitService.rebase(repoPath, branch)
  })

  // P0: Rebase abort
  ipcMain.handle('git:rebase-abort', async (_event, repoPath: string) => {
    return gitService.rebaseAbort(repoPath)
  })

  // P0: Merge
  ipcMain.handle('git:merge-branch', async (_event, repoPath: string, branch: string) => {
    return gitService.mergeBranch(repoPath, branch)
  })

  // P0: 冲突文件列表
  ipcMain.handle('git:conflicted-files', async (_event, repoPath: string) => {
    return gitService.getConflictedFiles(repoPath)
  })

  // P0: 冲突文件内容
  ipcMain.handle('git:conflict-file', async (_event, repoPath: string, filePath: string) => {
    return gitService.getConflictFile(repoPath, filePath)
  })

  // P0: 解决冲突
  ipcMain.handle('git:resolve-conflict', async (_event, repoPath: string, filePath: string, content: string) => {
    return gitService.resolveConflict(repoPath, filePath, content)
  })

  // P1: 提交修改的文件列表
  ipcMain.handle('git:commit-files', async (_event, repoPath: string, commitHash: string) => {
    return gitService.getCommitFiles(repoPath, commitHash)
  })

  // P1: 提交的 diff
  ipcMain.handle('git:commit-diff', async (_event, repoPath: string, commitHash: string, filePath?: string) => {
    return gitService.getCommitDiff(repoPath, commitHash, filePath)
  })

  // P1: 搜索提交
  ipcMain.handle('git:search-commits', async (_event, repoPath: string, query: string, options?: any) => {
    return gitService.searchCommits(repoPath, query, options)
  })

  // Terminal
  ipcMain.handle('git:exec', async (_event, repoPath: string, command: string) => {
    return gitService.execCommand(repoPath, command)
  })

  // Commit stat
  ipcMain.handle('git:commit-stat', async (_event, repoPath: string, commitHash: string) => {
    return gitService.getCommitStat(repoPath, commitHash)
  })

  ipcMain.handle('git:is-commit-on-current-branch', async (_event, repoPath: string, commitHash: string) => {
    return gitService.isCommitOnCurrentBranch(repoPath, commitHash)
  })
}
