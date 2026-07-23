export interface ElectronAPI {
  git: {
    status: (repoPath: string) => Promise<any>
    log: (repoPath: string, options?: { maxCount?: number; from?: string; to?: string }) => Promise<any>
    logGraph: (repoPath: string, maxCount?: number, branch?: string) => Promise<string>
    diff: (repoPath: string, file?: string) => Promise<string>
    diffIndex: (repoPath: string) => Promise<any>
    diffStaged: (repoPath: string, file?: string) => Promise<string>
    add: (repoPath: string, files: string[]) => Promise<void>
    addAll: (repoPath: string) => Promise<void>
    reset: (repoPath: string, files: string[]) => Promise<void>
    restore: (repoPath: string, files: string[]) => Promise<void>
    commit: (repoPath: string, message: string) => Promise<any>
    push: (repoPath: string, remote?: string, branch?: string) => Promise<void>
    pull: (repoPath: string, remote?: string, branch?: string) => Promise<void>
    fetch: (repoPath: string, remote?: string) => Promise<void>
    branchList: (repoPath: string) => Promise<any>
    remoteTrackingCommit: (repoPath: string, branch: string) => Promise<string | null>
    remoteCommits: (repoPath: string) => Promise<string[]>
    branchesAheadBehind: (repoPath: string) => Promise<Record<string, { ahead: number; behind: number }>>
    exec: (repoPath: string, command: string) => Promise<{ stdout: string; stderr: string }>
    branchCreate: (repoPath: string, branchName: string, startPoint?: string) => Promise<any>
    branchDelete: (repoPath: string, branchName: string, force?: boolean) => Promise<any>
    checkout: (repoPath: string, branch: string) => Promise<void>
    merge: (repoPath: string, branch: string) => Promise<any>
    rebase: (repoPath: string, branch: string) => Promise<any>
    stashList: (repoPath: string) => Promise<any>
    stashPush: (repoPath: string, message?: string, files?: string[]) => Promise<any>
    stashPop: (repoPath: string, stashRef?: string) => Promise<any>
    stashDrop: (repoPath: string, stashRef: string) => Promise<any>
    tagList: (repoPath: string) => Promise<any>
    tagCreate: (repoPath: string, tagName: string, ref?: string) => Promise<any>
    tagDelete: (repoPath: string, tagName: string) => Promise<any>
    remoteList: (repoPath: string) => Promise<any>
    remoteAdd: (repoPath: string, name: string, url: string) => Promise<void>
    remoteRemove: (repoPath: string, name: string) => Promise<void>
    config: (repoPath: string) => Promise<any>
    onProgress: (callback: (data: any) => void) => void
    removeProgressListener: () => void
  }
  repo: {
    add: (path: string) => Promise<{ id: string; name: string; path: string; addedAt: string }>
    list: () => Promise<Array<{ id: string; name: string; path: string; addedAt: string }>>
    remove: (id: string) => Promise<boolean>
  }
  dialog: {
    openFolder: () => Promise<string | null>
  }
  window: {
    minimize: () => void
    maximize: () => void
    close: () => void
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
