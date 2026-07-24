import { contextBridge, ipcRenderer } from 'electron'

const gitAPI = {
  status: (repoPath: string) => ipcRenderer.invoke('git:status', repoPath),
  log: (repoPath: string, options?: any) => ipcRenderer.invoke('git:log', repoPath, options),
  logGraph: (repoPath: string, maxCount?: number, branch?: string) => ipcRenderer.invoke('git:log-graph', repoPath, maxCount, branch),
  diff: (repoPath: string, file?: string) => ipcRenderer.invoke('git:diff', repoPath, file),
  diffIndex: (repoPath: string) => ipcRenderer.invoke('git:diff-index', repoPath),
  diffStaged: (repoPath: string, file?: string) => ipcRenderer.invoke('git:diff-staged', repoPath, file),
  add: (repoPath: string, files: string[]) => ipcRenderer.invoke('git:add', repoPath, files),
  addAll: (repoPath: string) => ipcRenderer.invoke('git:add-all', repoPath),
  reset: (repoPath: string, files: string[]) => ipcRenderer.invoke('git:reset', repoPath, files),
  restore: (repoPath: string, files: string[]) => ipcRenderer.invoke('git:restore', repoPath, files),
  commit: (repoPath: string, message: string) => ipcRenderer.invoke('git:commit', repoPath, message),
  push: (repoPath: string, remote?: string, branch?: string, force?: boolean) => ipcRenderer.invoke('git:push', repoPath, remote, branch, force),
  pull: (repoPath: string, remote?: string, branch?: string) => ipcRenderer.invoke('git:pull', repoPath, remote, branch),
  fetch: (repoPath: string, remote?: string) => ipcRenderer.invoke('git:fetch', repoPath, remote),
  branchList: async (repoPath: string) => {
    console.log('[Preload] git:branch-list called for:', repoPath)
    const result = await ipcRenderer.invoke('git:branch-list', repoPath)
    console.log('[Preload] git:branch-list result:', JSON.stringify(result))
    return result
  },
  remoteTrackingCommit: (repoPath: string, branch: string) => ipcRenderer.invoke('git:remote-tracking-commit', repoPath, branch),
  remoteCommits: (repoPath: string) => ipcRenderer.invoke('git:remote-commits', repoPath),
  branchesAheadBehind: (repoPath: string) => ipcRenderer.invoke('git:branches-ahead-behind', repoPath),
  branchCreate: (repoPath: string, branchName: string, startPoint?: string) => ipcRenderer.invoke('git:branch-create', repoPath, branchName, startPoint),
  branchDelete: (repoPath: string, branchName: string, force?: boolean) => ipcRenderer.invoke('git:branch-delete', repoPath, branchName, force),
  checkout: (repoPath: string, branch: string) => ipcRenderer.invoke('git:checkout', repoPath, branch),
  merge: (repoPath: string, branch: string) => ipcRenderer.invoke('git:merge', repoPath, branch),
  rebase: (repoPath: string, branch: string) => ipcRenderer.invoke('git:rebase', repoPath, branch),
  stashList: (repoPath: string) => ipcRenderer.invoke('git:stash-list', repoPath),
  stashPush: (repoPath: string, message?: string, files?: string[]) => ipcRenderer.invoke('git:stash-push', repoPath, message, files),
  stashPop: (repoPath: string, stashRef?: string) => ipcRenderer.invoke('git:stash-pop', repoPath, stashRef),
  stashDrop: (repoPath: string, stashRef: string) => ipcRenderer.invoke('git:stash-drop', repoPath, stashRef),
  stashShowFiles: (repoPath: string, stashRef: string) => ipcRenderer.invoke('git:stash-show-files', repoPath, stashRef),
  stashShowDiff: (repoPath: string, stashRef: string, filePath?: string) => ipcRenderer.invoke('git:stash-show-diff', repoPath, stashRef, filePath),
  tagList: (repoPath: string) => ipcRenderer.invoke('git:tag-list', repoPath),
  tagCreate: (repoPath: string, tagName: string, ref?: string) => ipcRenderer.invoke('git:tag-create', repoPath, tagName, ref),
  tagDelete: (repoPath: string, tagName: string) => ipcRenderer.invoke('git:tag-delete', repoPath, tagName),
  remoteList: (repoPath: string) => ipcRenderer.invoke('git:remote-list', repoPath),
  remoteAdd: (repoPath: string, name: string, url: string) => ipcRenderer.invoke('git:remote-add', repoPath, name, url),
  remoteRemove: (repoPath: string, name: string) => ipcRenderer.invoke('git:remote-remove', repoPath, name),
  config: (repoPath: string) => ipcRenderer.invoke('git:config', repoPath),
  // P0
  resetCommit: (repoPath: string, commitHash: string, mode: string) => ipcRenderer.invoke('git:reset-commit', repoPath, commitHash, mode),
  amendCommit: (repoPath: string, message: string) => ipcRenderer.invoke('git:amend-commit', repoPath, message),
  cherryPick: (repoPath: string, commitHash: string) => ipcRenderer.invoke('git:cherry-pick', repoPath, commitHash),
  mergeBranch: (repoPath: string, branch: string) => ipcRenderer.invoke('git:merge-branch', repoPath, branch),
  rebaseAbort: (repoPath: string) => ipcRenderer.invoke('git:rebase-abort', repoPath),
  conflictedFiles: (repoPath: string) => ipcRenderer.invoke('git:conflicted-files', repoPath),
  conflictFile: (repoPath: string, filePath: string) => ipcRenderer.invoke('git:conflict-file', repoPath, filePath),
  resolveConflict: (repoPath: string, filePath: string, content: string) => ipcRenderer.invoke('git:resolve-conflict', repoPath, filePath, content),
  // P1
  commitFiles: (repoPath: string, commitHash: string) => ipcRenderer.invoke('git:commit-files', repoPath, commitHash),
  commitDiff: (repoPath: string, commitHash: string, filePath?: string) => ipcRenderer.invoke('git:commit-diff', repoPath, commitHash, filePath),
  searchCommits: (repoPath: string, query: string, options?: any) => ipcRenderer.invoke('git:search-commits', repoPath, query, options),
  exec: (repoPath: string, command: string) => ipcRenderer.invoke('git:exec', repoPath, command),
  commitStat: (repoPath: string, commitHash: string) => ipcRenderer.invoke('git:commit-stat', repoPath, commitHash),
  isCommitOnCurrentBranch: (repoPath: string, commitHash: string) => ipcRenderer.invoke('git:is-commit-on-current-branch', repoPath, commitHash),
  onProgress: (callback: (data: any) => void) => {
    ipcRenderer.on('git:progress', (_event, data) => callback(data))
  },
  removeProgressListener: () => {
    ipcRenderer.removeAllListeners('git:progress')
  },
}

const repoAPI = {
  add: (path: string) => ipcRenderer.invoke('repo:add', path),
  list: () => ipcRenderer.invoke('repo:list'),
  remove: (id: string) => ipcRenderer.invoke('repo:remove', id),
}

const dialogAPI = {
  openFolder: () => ipcRenderer.invoke('dialog:open-folder'),
}

const windowAPI = {
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
}

contextBridge.exposeInMainWorld('electronAPI', {
  git: gitAPI,
  repo: repoAPI,
  dialog: dialogAPI,
  window: windowAPI,
})
