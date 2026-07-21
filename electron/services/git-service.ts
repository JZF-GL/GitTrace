import simpleGit, { SimpleGit, LogResult, StatusResult, DiffResult } from 'simple-git'

const gitInstances = new Map<string, SimpleGit>()

function getGit(repoPath: string): SimpleGit {
  if (!gitInstances.has(repoPath)) {
    gitInstances.set(repoPath, simpleGit(repoPath))
  }
  return gitInstances.get(repoPath)!
}

export async function getStatus(repoPath: string): Promise<any> {
  const status = await getGit(repoPath).status()
  return {
    not_added: status.not_added,
    created: status.created,
    deleted: status.deleted,
    modified: status.modified,
    renamed: status.renamed,
    files: status.files.map(f => ({
      path: f.path,
      index: f.index,
      working_dir: f.working_dir,
    })),
    staged: status.staged,
    ahead: status.ahead,
    behind: status.behind,
    current: status.current,
    tracking: status.tracking,
    conflicted: status.conflicted,
  }
}

export async function getLog(repoPath: string, options?: { maxCount?: number; from?: string; to?: string }): Promise<any> {
  const git = getGit(repoPath)
  const logOptions: any = {}
  if (options?.maxCount) logOptions.maxCount = options.maxCount
  if (options?.from) logOptions.from = options.from
  if (options?.to) logOptions.to = options.to
  const log = await git.log(logOptions)
  return {
    all: log.all.map(l => ({
      hash: l.hash,
      date: l.date,
      message: l.message,
      author_name: l.author_name,
      author_email: l.author_email,
      refs: l.refs,
    })),
    latest: log.latest ? {
      hash: log.latest.hash,
      date: log.latest.date,
      message: log.latest.message,
      author_name: log.latest.author_name,
    } : null,
    total: log.total,
  }
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
  console.log('[GitService] logGraph raw output (first 1000 chars):', result.substring(0, 1000))
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

export async function getDiffStaged(repoPath: string, file?: string): Promise<string> {
  const git = getGit(repoPath)
  if (file) {
    return git.diff(['--cached', file])
  }
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
  const result = await git.commit(message)
  return {
    branch: result.branch,
    commit: result.commit,
    summary: {
      changes: result.summary.changes,
      insertions: result.summary.insertions,
      deletions: result.summary.deletions,
    },
  }
}

export async function push(repoPath: string, remote?: string, branch?: string): Promise<any> {
  try {
    const git = getGit(repoPath)
    const result = await git.push(remote || 'origin', branch)
    return { success: true, message: '推送成功' }
  } catch (e: any) {
    return { success: false, message: e.message || String(e) }
  }
}

export async function pull(repoPath: string, remote?: string, branch?: string): Promise<any> {
  try {
    const git = getGit(repoPath)
    const result = await git.pull(remote || 'origin', branch)
    return { success: true, message: '拉取成功', summary: result.summary }
  } catch (e: any) {
    return { success: false, message: e.message || String(e) }
  }
}

export async function fetch(repoPath: string, remote?: string): Promise<any> {
  try {
    const git = getGit(repoPath)
    await git.fetch(remote || 'origin')
    return { success: true, message: '获取成功' }
  } catch (e: any) {
    return { success: false, message: e.message || String(e) }
  }
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
      // Use raw git command for more reliable remote branch listing
      const raw = await git.raw(['branch', '-r'])
      console.log('[GitService] branch -r raw:', raw)
      if (raw) {
        remoteBranches = raw.split('\n')
          .map(l => l.trim())
          .filter(l => l && !l.includes('HEAD') && l.includes('/'))
          .map(l => l.replace(/^origin\//, ''))
          .filter(l => l)
      }
    } catch (e) {
      console.log('[GitService] branch -r error:', e)
    }

    console.log('[GitService] final remoteBranches:', remoteBranches)
    return { local: localBranches, current, remote: remoteBranches }
  } catch (e) {
    console.error('[GitService] branchList error:', e)
    return { local: [], current: '', remote: [] }
  }
}

export async function branchCreate(repoPath: string, branchName: string, startPoint?: string): Promise<any> {
  try {
    const git = getGit(repoPath)
    await git.checkoutLocalBranch(branchName)
    return { success: true, message: `分支 ${branchName} 创建成功` }
  } catch (e: any) {
    return { success: false, message: e.message || String(e) }
  }
}

export async function branchDelete(repoPath: string, branchName: string, force?: boolean): Promise<any> {
  try {
    const git = getGit(repoPath)
    await git.deleteLocalBranch(branchName, force)
    return { success: true, message: `分支 ${branchName} 已删除` }
  } catch (e: any) {
    return { success: false, message: e.message || String(e) }
  }
}

export async function checkout(repoPath: string, branch: string): Promise<any> {
  try {
    const git = getGit(repoPath)
    await git.checkout(branch)
    return { success: true, message: `已切换到 ${branch}` }
  } catch (e: any) {
    return { success: false, message: e.message || String(e) }
  }
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
  const list = await git.stashList()
  return {
    all: list.all.map(s => ({
      hash: s.hash,
      date: s.date,
      message: s.message,
    })),
  }
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
  const tags = await git.tags()
  return {
    all: tags.all,
    latest: tags.latest,
  }
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
  const remotes = await git.getRemotes(true)
  return remotes.map((r: any) => ({
    name: r.name,
    refs: {
      fetch: r.refs.fetch,
      push: r.refs.push,
    },
  }))
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
  const config = await git.listConfig()
  const result: Record<string, Record<string, string>> = {}
  for (const [key, value] of Object.entries(config.all)) {
    const parts = key.split('.')
    if (parts.length >= 2) {
      const section = parts[0]
      const prop = parts.slice(1).join('.')
      if (!result[section]) result[section] = {}
      result[section][prop] = String(value)
    }
  }
  return result
}
