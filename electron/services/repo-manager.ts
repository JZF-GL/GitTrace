import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { basename } from 'path'

export interface RepoEntry {
  id: string
  name: string
  path: string
  addedAt: string
}

function getConfigPath(): string {
  return join(app.getPath('userData'), 'repos.json')
}

function loadRepos(): RepoEntry[] {
  const configPath = getConfigPath()
  if (!existsSync(configPath)) return []
  try {
    return JSON.parse(readFileSync(configPath, 'utf-8'))
  } catch {
    return []
  }
}

function saveRepos(repos: RepoEntry[]): void {
  writeFileSync(getConfigPath(), JSON.stringify(repos, null, 2))
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

class RepoManager {
  add(path: string): RepoEntry {
    const repos = loadRepos()
    const existing = repos.find(r => r.path === path)
    if (existing) return existing

    const entry: RepoEntry = {
      id: generateId(),
      name: basename(path),
      path,
      addedAt: new Date().toISOString(),
    }
    repos.push(entry)
    saveRepos(repos)
    return entry
  }

  list(): RepoEntry[] {
    return loadRepos()
  }

  remove(id: string): boolean {
    const repos = loadRepos()
    const index = repos.findIndex(r => r.id === id)
    if (index === -1) return false
    repos.splice(index, 1)
    saveRepos(repos)
    return true
  }

  get(id: string): RepoEntry | undefined {
    return loadRepos().find(r => r.id === id)
  }
}

export const repoManager = new RepoManager()
