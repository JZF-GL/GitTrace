import simpleGit, { SimpleGit, LogResult, StatusResult, DiffResult } from 'simple-git'

const gitInstances = new Map<string, SimpleGit>()

function getGit(repoPath: string): SimpleGit {
  if (!gitInstances.has(repoPath)) {
    gitInstances.set(repoPath, simpleGit(repoPath))
  }
  return gitInstances.get(repoPath)!
}

export async function getStatus(repoPath: string): Promise<StatusResult> {
  return getGit(repoPath).status()
}

export async function getLog(repoPath: string, options?: { maxCount?: number; from?: string; to?: string }): Promise<LogResult> {
  const git = getGit(repoPath)
  const logOptions: any = {}
  if (options?.maxCount) logOptions.maxCount = options.maxCount
  if (options?.from) logOptions.from = options.from
  if (options?.to) logOptions.to = options.to
  return git.log(logOptions)
}

export async function getLogGraph(repoPath: string, maxCount: number = 200): Promise<string> {
  const git = getGit(repoPath)
  const result = await git.raw([
    'log',
    '--graph',
    '--all',
    '--oneline',
    '--decorate',
    '--format=%H|%P|%h|%an|%ai|%s',
    `--max-count=${maxCount}`,
  ])
  return result
}

export async function getDiff(repoPath: string, file?: string): Promise<string> {
  const git = getGit(repoPath)
  if (file) {
    return git.diff([file])
  }
  return git.diff()
}

export async function getDiffIndex(repoPath: string): Promise<DiffResult> {
  const git = getGit(repoPath)
  return git.diffStatus()
}

export async function getDiffStaged(repoPath: string): Promise<string> {
  const git = getGit(repoPath)
  return git.diff(['--cached'])
}

export async function addFiles(repoPath: string, files: string[]): Promise<void> {
  const git = getGit(repoPath)
  await git.add(files)
}

export async function addAll(repoPath: string): Promise<void> {
  const git = getGit(repoPath)
  await git.add('./*')
}

export async function resetFiles(repoPath: string, files: string[]): Promise<void> {
  const git = getGit(repoPath)
  await git.reset(['HEAD', ...files])
}

export async function commit(repoPath: string, message: string): Promise<any> {
  const git = getGit(repoPath)
  return git.commit(message)
}

export async function push(repoPath: string, remote?: string, branch?: string): Promise<void> {
  const git = getGit(repoPath)
  await git.push(remote || 'origin', branch)
}

export async function pull(repoPath: string, remote?: string, branch?: string): Promise<void> {
  const git = getGit(repoPath)
  await git.pull(remote || 'origin', branch)
}

export async function fetch(repoPath: string, remote?: string): Promise<void> {
  const git = getGit(repoPath)
  await git.fetch(remote || 'origin')
}

export async function branchList(repoPath: string): Promise<any> {
  try {
    const git = getGit(repoPath)
    const branchSummary = await git.branchLocal()
    const current = branchSummary.current
    const localBranches = Object.keys(branchSummary.branches).map(name => ({
      name,
      current: name === current,
      commit: branchSummary.branches[name].commit,
    }))

    let remoteBranches: string[] = []
    try {
      remoteBranches = await git.branchRemote()
    } catch {
      // No remote configured
    }

    return { local: localBranches, current, remote: remoteBranches }
  } catch (e) {
    console.error('[GitService] branchList error:', e)
    return { local: [], current: '', remote: [] }
  }
}

export async function branchCreate(repoPath: string, branchName: string, startPoint?: string): Promise<any> {
  const git = getGit(repoPath)
  if (startPoint) {
    return git.checkoutLocalBranch(branchName)
  }
  return git.checkoutLocalBranch(branchName)
}

export async function branchDelete(repoPath: string, branchName: string, force?: boolean): Promise<any> {
  const git = getGit(repoPath)
  return git.deleteLocalBranch(branchName, force)
}

export async function checkout(repoPath: string, branch: string): Promise<void> {
  const git = getGit(repoPath)
  await git.checkout(branch)
}

export async function merge(repoPath: string, branch: string): Promise<any> {
  const git = getGit(repoPath)
  return git.merge([branch])
}

export async function rebase(repoPath: string, branch: string): Promise<any> {
  const git = getGit(repoPath)
  return git.rebase([branch])
}

export async function stashList(repoPath: string): Promise<any> {
  const git = getGit(repoPath)
  return git.stashList()
}

export async function stashPush(repoPath: string, message?: string): Promise<any> {
  const git = getGit(repoPath)
  return git.stashPush(message ? ['-m', message] : [])
}

export async function stashPop(repoPath: string): Promise<any> {
  const git = getGit(repoPath)
  return git.stashPop()
}

export async function stashDrop(repoPath: string, stashRef: string): Promise<any> {
  const git = getGit(repoPath)
  return git.stashDrop(stashRef)
}

export async function tagList(repoPath: string): Promise<any> {
  const git = getGit(repoPath)
  return git.tags()
}

export async function tagCreate(repoPath: string, tagName: string, ref?: string): Promise<any> {
  const git = getGit(repoPath)
  return git.addAnnotatedTag(tagName, '', ref)
}

export async function tagDelete(repoPath: string, tagName: string): Promise<any> {
  const git = getGit(repoPath)
  return git.deleteTag(tagName)
}

export async function remoteList(repoPath: string): Promise<any> {
  const git = getGit(repoPath)
  return git.getRemotes(true)
}

export async function remoteAdd(repoPath: string, name: string, url: string): Promise<void> {
  const git = getGit(repoPath)
  await git.addRemote(name, url)
}

export async function remoteRemove(repoPath: string, name: string): Promise<void> {
  const git = getGit(repoPath)
  await git.removeRemote(name)
}

export async function getConfig(repoPath: string): Promise<any> {
  const git = getGit(repoPath)
  return git.listConfig()
}
