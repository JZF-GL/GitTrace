import simpleGit, { SimpleGit, LogResult, StatusResult } from 'simple-git'

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

export async function getLogGraph(repoPath: string, maxCount: number = 200, branch?: string): Promise<string> {
  const git = getGit(repoPath)
  const args = [
    'log',
    '--oneline',
    '--decorate',
    '--format=%H|%P|%h|%an|%ai|%s',
    `--max-count=${maxCount}`,
  ]
  if (branch) {
    args.push(branch)
  } else {
    args.push('--all')
  }
  const result = await git.raw(args)
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

export async function getDiffIndex(repoPath: string): Promise<any> {
  const git = getGit(repoPath)
  return git.status()
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

export async function restoreFiles(repoPath: string, files: string[]): Promise<void> {
  const git = getGit(repoPath)
  const fs = require('fs')
  const path = require('path')

  // 先获取状态，区分已跟踪和未跟踪文件
  const status = await git.status()
  const trackedFiles: string[] = []
  const untrackedFiles: string[] = []

  for (const file of files) {
    if (status.not_added.includes(file) || status.created.includes(file)) {
      untrackedFiles.push(file)
    } else {
      trackedFiles.push(file)
    }
  }

  // 已跟踪文件使用 checkout
  if (trackedFiles.length > 0) {
    await git.checkout(['--', ...trackedFiles])
  }

  // 未跟踪文件直接删除
  for (const file of untrackedFiles) {
    const fullPath = path.join(repoPath, file)
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath)
    }
  }
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

export async function getRemoteTrackingCommit(repoPath: string, branch: string): Promise<string | null> {
  try {
    const git = getGit(repoPath)
    // 获取当前分支的远程跟踪分支
    const raw = await git.raw(['rev-parse', '--verify', `@{upstream}`])
    if (raw && raw.trim()) {
      return raw.trim()
    }
    return null
  } catch (e) {
    // 没有设置远程跟踪分支
    return null
  }
}

export async function getRemoteCommits(repoPath: string): Promise<string[]> {
  try {
    const git = getGit(repoPath)
    // 获取远程跟踪分支的所有 commit hashes
    const raw = await git.raw(['log', '--oneline', '--format=%H', '@{upstream}'])
    if (raw && raw.trim()) {
      return raw.trim().split('\n').filter(h => h)
    }
    return []
  } catch (e) {
    // 没有设置远程跟踪分支或远程分支
    return []
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

export async function stashPush(repoPath: string, message?: string, files?: string[]): Promise<any> {
  try {
    const git = getGit(repoPath)
    const args = ['push', '--include-untracked']
    if (message) {
      args.push('-m', message)
    }
    if (files && files.length > 0) {
      args.push('--', ...files)
    }
    await git.stash(args)
    return { success: true, message: '暂存成功' }
  } catch (e: any) {
    return { success: false, message: e.message || String(e) }
  }
}

export async function stashPop(repoPath: string, stashRef?: string): Promise<any> {
  try {
    const git = getGit(repoPath)
    await git.stash(['pop', ...(stashRef ? [stashRef] : [])])
    return { success: true, message: '弹出成功' }
  } catch (e: any) {
    return { success: false, message: e.message || String(e) }
  }
}

export async function stashDrop(repoPath: string, stashRef: string): Promise<any> {
  try {
    const git = getGit(repoPath)
    await git.stash(['drop', stashRef])
    return { success: true, message: '删除成功' }
  } catch (e: any) {
    return { success: false, message: e.message || String(e) }
  }
}

export async function stashShowFiles(repoPath: string, stashRef: string): Promise<any> {
  try {
    const git = getGit(repoPath)
    const result = await git.raw(['stash', 'show', '--name-status', '-u', stashRef])
    const files = result.split('\n').filter(l => l.trim()).map(l => {
      const parts = l.trim().split('\t')
      return { status: parts[0] || 'M', path: parts[1] || '' }
    }).filter(f => f.path)
    return { files }
  } catch (e: any) {
    return { files: [], error: e.message }
  }
}

export async function stashShowDiff(repoPath: string, stashRef: string, filePath?: string): Promise<string> {
  try {
    const git = getGit(repoPath)
    console.log('[stashShowDiff] stashRef:', stashRef, 'filePath:', filePath)
    const fullDiff = await git.raw(['stash', 'show', '-p', '-u', stashRef])
    console.log('[stashShowDiff] fullDiff length:', fullDiff.length)
    if (!filePath) return fullDiff
    // Parse full diff to extract specific file's diff
    const sections = fullDiff.split(/^diff --git /m).filter(s => s.trim())
    console.log('[stashShowDiff] sections:', sections.length)
    for (const section of sections) {
      const header = section.split('\n')[0]
      if (header.includes('a/' + filePath) || header.includes('b/' + filePath)) {
        console.log('[stashShowDiff] matched:', header)
        return 'diff --git ' + section
      }
    }
    console.log('[stashShowDiff] no match for:', filePath)
    return ''
  } catch (e: any) {
    return e.message || String(e)
  }
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
    const fs = require('fs')
    const path = require('path')

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

    // 工作区版本 (直接从磁盘读取，包含冲突标记)
    let working = ''
    try {
      const fullPath = path.join(repoPath, filePath)
      working = fs.readFileSync(fullPath, 'utf-8')
    } catch { working = '' }

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
    console.log('[GitService] getCommitFiles called with:', commitHash)
    // Check if it's the first commit
    const catFile = await git.raw(['cat-file', '-p', commitHash])
    const parentMatch = catFile.match(/^parent\s+(\w+)/m)
    if (!parentMatch) {
      // Root commit - list all files in the tree
      const result = await git.raw(['diff-tree', '--no-commit-id', '-r', '--name-status', '--root', commitHash])
      console.log('[GitService] root commit diff-tree result:', result)
      const files = result.split('\n').filter(l => l.trim()).map(l => {
        const parts = l.trim().split('\t')
        return { status: parts[0] || 'A', path: parts[1] || parts[0] }
      }).filter(f => f.path)
      console.log('[GitService] root commit files:', files)
      return { files }
    }
    // Use -m for merge commits to show changes against first parent
    const result = await git.raw(['diff-tree', '--no-commit-id', '-r', '-m', '--name-status', commitHash])
    console.log('[GitService] diff-tree result:', result)
    const files = result.split('\n').filter(l => l.trim()).map(l => {
      const parts = l.trim().split('\t')
      return { status: parts[0], path: parts[1] }
    }).filter(f => f.path)
    console.log('[GitService] parsed files:', files)
    return { files }
  } catch (e: any) {
    console.error('[GitService] getCommitFiles error:', e)
    return { files: [], error: e.message }
  }
}

// P1: 获取指定提交的 diff
export async function getCommitDiff(repoPath: string, commitHash: string, filePath?: string): Promise<string> {
  try {
    const git = getGit(repoPath)
    console.log('[GitService] getCommitDiff called:', { commitHash, filePath })
    // Check if it's a merge commit
    const catFile = await git.raw(['cat-file', '-p', commitHash])
    const parentMatches = catFile.match(/^parent\s+(\w+)/gm)
    const isMerge = parentMatches && parentMatches.length > 1

    const fileArgs = filePath ? ['--', filePath] : []

    if (isMerge) {
      // For merge commits, use -m to diff against each parent
      const result = await git.raw(['diff-tree', '-p', '-m', commitHash, ...fileArgs])
      console.log('[GitService] merge commit diff result length:', result.length)
      return result
    }

    // For regular commits
    const result = await git.raw(['diff-tree', '-p', commitHash, ...fileArgs])
    console.log('[GitService] diff result length:', result.length)
    return result
  } catch (e: any) {
    console.error('[GitService] getCommitDiff error:', e)
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
