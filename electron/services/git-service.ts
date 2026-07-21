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
    // Check if it's a merge conflict
    const git = getGit(repoPath)
    try {
      const status = await git.status()
      if (status.conflicted.length > 0) {
        return { success: false, conflict: true, message: `合并冲突: ${status.conflicted.length} 个文件`, files: status.conflicted }
      }
    } catch {}
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
      if (raw) {
        remoteBranches = raw.split('\n')
          .map(l => l.trim())
          .filter(l => l && !l.includes('HEAD'))
          .map(l => {
            // Remove remote prefix like "origin/"
            const parts = l.split('/')
            return parts.length > 1 ? parts.slice(1).join('/') : l
          })
          .filter(l => l)
      }
    } catch (e) {
      // No remote branches
    }

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

// P0: 撤销提交
export async function resetCommit(repoPath: string, commitHash: string, mode: 'soft' | 'mixed' | 'hard'): Promise<any> {
  try {
    const git = getGit(repoPath)
    await git.raw(['reset', `--${mode}`, commitHash])
    return { success: true, message: `已${mode === 'soft' ? '软' : mode === 'hard' ? '硬' : ''}重置到 ${commitHash.substring(0, 7)}` }
  } catch (e: any) {
    return { success: false, message: e.message || String(e) }
  }
}

// P0: Amend 提交
export async function amendCommit(repoPath: string, message: string): Promise<any> {
  try {
    const git = getGit(repoPath)
    await git.commit(['--amend', '-m', message])
    return { success: true, message: '提交已修改' }
  } catch (e: any) {
    return { success: false, message: e.message || String(e) }
  }
}

// P0: Cherry-pick
export async function cherryPick(repoPath: string, commitHash: string): Promise<any> {
  try {
    const git = getGit(repoPath)
    await git.raw(['cherry-pick', commitHash])
    return { success: true, message: `已 cherry-pick ${commitHash.substring(0, 7)}` }
  } catch (e: any) {
    return { success: false, message: e.message || String(e) }
  }
}

// P0: Rebase
export async function rebase(repoPath: string, branch: string, interactive?: boolean): Promise<any> {
  try {
    const git = getGit(repoPath)
    const args = interactive ? ['rebase', '-i', branch] : ['rebase', branch]
    await git.raw(args)
    return { success: true, message: `已 rebase 到 ${branch}` }
  } catch (e: any) {
    return { success: false, message: e.message || String(e) }
  }
}

// P0: Rebase --abort
export async function rebaseAbort(repoPath: string): Promise<any> {
  try {
    const git = getGit(repoPath)
    await git.raw(['rebase', '--abort'])
    return { success: true, message: 'Rebase 已取消' }
  } catch (e: any) {
    return { success: false, message: e.message || String(e) }
  }
}

// P0: Merge
export async function mergeBranch(repoPath: string, branch: string): Promise<any> {
  try {
    const git = getGit(repoPath)
    const result = await git.merge([branch])
    return { success: true, message: `已合并 ${branch}`, summary: result?.summary }
  } catch (e: any) {
    // Check if it's a conflict
    const status = await git.status()
    if (status.conflicted.length > 0) {
      return { success: false, conflict: true, message: `合并冲突: ${status.conflicted.length} 个文件有冲突`, files: status.conflicted }
    }
    return { success: false, message: e.message || String(e) }
  }
}

// P0: 冲突文件列表
export async function getConflictedFiles(repoPath: string): Promise<any> {
  try {
    const git = getGit(repoPath)
    const status = await git.status()
    return { files: status.conflicted }
  } catch (e: any) {
    return { files: [], error: e.message }
  }
}

// P0: 读取冲突文件内容（三个版本）
export async function getConflictFile(repoPath: string, filePath: string): Promise<any> {
  try {
    const git = getGit(repoPath)
    // 当前版本 (HEAD)
    let ours = ''
    try {
      ours = await git.raw(['show', `HEAD:${filePath}`])
    } catch { ours = '' }

    // 合并版本 (MERGE_HEAD)
    let theirs = ''
    try {
      theirs = await git.raw(['show', `MERGE_HEAD:${filePath}`])
    } catch { theirs = '' }

    // 工作区版本 (包含冲突标记)
    const working = await git.raw(['show', `:${filePath}`])

    return { ours, theirs, working }
  } catch (e: any) {
    return { ours: '', theirs: '', working: '', error: e.message }
  }
}

// P0: 解决冲突（使用指定版本）
export async function resolveConflict(repoPath: string, filePath: string, content: string): Promise<any> {
  try {
    const git = getGit(repoPath)
    // 写入文件
    const fs = require('fs')
    const fullPath = require('path').join(repoPath, filePath)
    fs.writeFileSync(fullPath, content, 'utf-8')
    // 标记为已解决
    await git.add(filePath)
    return { success: true, message: `${filePath} 冲突已解决` }
  } catch (e: any) {
    return { success: false, message: e.message || String(e) }
  }
}

// P1: 获取提交修改的文件列表
export async function getCommitFiles(repoPath: string, commitHash: string): Promise<any> {
  try {
    const git = getGit(repoPath)
    // Check if it's the first commit
    const catFile = await git.raw(['cat-file', '-p', commitHash])
    const parentMatch = catFile.match(/^parent\s+(\w+)/m)
    if (!parentMatch) {
      // Root commit - list all files in the tree
      const result = await git.raw(['diff-tree', '--no-commit-id', '-r', '--name-status', '--root', commitHash])
      const files = result.split('\n').filter(l => l.trim()).map(l => {
        const parts = l.trim().split('\t')
        return { status: parts[0] || 'A', path: parts[1] || parts[0] }
      }).filter(f => f.path)
      return { files }
    }
    const result = await git.raw(['diff-tree', '--no-commit-id', '-r', '--name-status', commitHash])
    const files = result.split('\n').filter(l => l.trim()).map(l => {
      const parts = l.trim().split('\t')
      return { status: parts[0], path: parts[1] }
    }).filter(f => f.path)
    return { files }
  } catch (e: any) {
    return { files: [], error: e.message }
  }
}

// P1: 获取指定提交的 diff
export async function getCommitDiff(repoPath: string, commitHash: string, filePath?: string): Promise<string> {
  try {
    const git = getGit(repoPath)
    // Check if it's the first commit (no parent)
    const catFile = await git.raw(['cat-file', '-p', commitHash])
    const parentMatch = catFile.match(/^parent\s+(\w+)/m)
    if (!parentMatch) {
      // Root commit - show full tree diff
      if (filePath) {
        return await git.raw(['diff', '--root', commitHash, '--', filePath])
      }
      return await git.raw(['diff', '--root', commitHash])
    }
    if (filePath) {
      return await git.raw(['diff', `${commitHash}^`, commitHash, '--', filePath])
    }
    return await git.raw(['diff', `${commitHash}^`, commitHash])
  } catch (e: any) {
    return e.message || String(e)
  }
}

// P1: 搜索提交
export async function searchCommits(repoPath: string, query: string, options?: { author?: string; since?: string; until?: string }): Promise<any> {
  try {
    const git = getGit(repoPath)
    const args = ['log', '--all', '--format=%H|%P|%h|%an|%ai|%s', '--max-count=100']

    if (query) {
      args.push(`--grep=${query}`)
    }
    if (options?.author) {
      args.push(`--author=${options.author}`)
    }
    if (options?.since) {
      args.push(`--since=${options.since}`)
    }
    if (options?.until) {
      args.push(`--until=${options.until}`)
    }

    const raw = await git.raw(args)
    const lines = raw.split('\n').filter(l => l.trim())
    const commits = lines.map(l => {
      const match = l.match(/^(.+)\|(.*)\|(.*)\|(.*)\|(.*)\|(.*)$/)
      if (!match) return null
      const [, hash, parentHashes, shortHash, author, date, message] = match
      return { hash, shortHash, parentHashes: parentHashes.split(' '), author, date, message }
    }).filter(Boolean)

    return { commits }
  } catch (e: any) {
    return { commits: [], error: e.message }
  }
}
