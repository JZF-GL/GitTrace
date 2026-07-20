import { contextBridge, ipcRenderer } from 'electron'

const gitAPI = {
  status: (repoPath: string) => ipcRenderer.invoke('git:status', repoPath),
  log: (repoPath: string, options?: any) => ipcRenderer.invoke('git:log', repoPath, options),
  logGraph: (repoPath: string, maxCount?: number) => ipcRenderer.invoke('git:log-graph', repoPath, maxCount),
  diff: (repoPath: string, file?: string) => ipcRenderer.invoke('git:diff', repoPath, file),
  diffIndex: (repoPath: string) => ipcRenderer.invoke('git:diff-index', repoPath),
  diffStaged: (repoPath: string) => ipcRenderer.invoke('git:diff-staged', repoPath),
  add: (repoPath: string, files: string[]) => ipcRenderer.invoke('git:add', repoPath, files),
  addAll: (repoPath: string) => ipcRenderer.invoke('git:add-all', repoPath),
  reset: (repoPath: string, files: string[]) => ipcRenderer.invoke('git:reset', repoPath, files),
  commit: (repoPath: string, message: string) => ipcRenderer.invoke('git:commit', repoPath, message),
  push: (repoPath: string, remote?: string, branch?: string) => ipcRenderer.invoke('git:push', repoPath, remote, branch),
  pull: (repoPath: string, remote?: string, branch?: string) => ipcRenderer.invoke('git:pull', repoPath, remote, branch),
  fetch: (repoPath: string, remote?: string) => ipcRenderer.invoke('git:fetch', repoPath, remote),
  branchList: async (repoPath: string) => {
    console.log('[Preload] git:branch-list called for:', repoPath)
    const result = await ipcRenderer.invoke('git:branch-list', repoPath)
    console.log('[Preload] git:branch-list result:', JSON.stringify(result))
    return result
  },
  branchCreate: (repoPath: string, branchName: string, startPoint?: string) => ipcRenderer.invoke('git:branch-create', repoPath, branchName, startPoint),
  branchDelete: (repoPath: string, branchName: string, force?: boolean) => ipcRenderer.invoke('git:branch-delete', repoPath, branchName, force),
  checkout: (repoPath: string, branch: string) => ipcRenderer.invoke('git:checkout', repoPath, branch),
  merge: (repoPath: string, branch: string) => ipcRenderer.invoke('git:merge', repoPath, branch),
  rebase: (repoPath: string, branch: string) => ipcRenderer.invoke('git:rebase', repoPath, branch),
  stashList: (repoPath: string) => ipcRenderer.invoke('git:stash-list', repoPath),
  stashPush: (repoPath: string, message?: string) => ipcRenderer.invoke('git:stash-push', repoPath, message),
  stashPop: (repoPath: string) => ipcRenderer.invoke('git:stash-pop', repoPath),
  stashDrop: (repoPath: string, stashRef: string) => ipcRenderer.invoke('git:stash-drop', repoPath, stashRef),
  tagList: (repoPath: string) => ipcRenderer.invoke('git:tag-list', repoPath),
  tagCreate: (repoPath: string, tagName: string, ref?: string) => ipcRenderer.invoke('git:tag-create', repoPath, tagName, ref),
  tagDelete: (repoPath: string, tagName: string) => ipcRenderer.invoke('git:tag-delete', repoPath, tagName),
  remoteList: (repoPath: string) => ipcRenderer.invoke('git:remote-list', repoPath),
  remoteAdd: (repoPath: string, name: string, url: string) => ipcRenderer.invoke('git:remote-add', repoPath, name, url),
  remoteRemove: (repoPath: string, name: string) => ipcRenderer.invoke('git:remote-remove', repoPath, name),
  config: (repoPath: string) => ipcRenderer.invoke('git:config', repoPath),
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
