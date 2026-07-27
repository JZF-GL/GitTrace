import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'

export interface Settings {
  commitPrefixes: {
    global: string[]
    projects: Record<string, string[]>
  }
  terminalCommands: {
    global: string[]
    projects: Record<string, string[]>
  }
}

const DEFAULT_COMMIT_PREFIXES = ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert']

const DEFAULT_TERMINAL_COMMANDS = [
  'git status', 'git add .', 'git add -A', 'git commit -m ""',
  'git push', 'git pull', 'git fetch', 'git log --oneline -20',
  'git diff', 'git diff --cached', 'git branch', 'git branch -a',
  'git merge ', 'git stash', 'git stash pop', 'git checkout ',
  'git reset HEAD~1', 'git restore ',
]

function getConfigPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

function getDefaultSettings(): Settings {
  return {
    commitPrefixes: { global: [...DEFAULT_COMMIT_PREFIXES], projects: {} },
    terminalCommands: { global: [...DEFAULT_TERMINAL_COMMANDS], projects: {} },
  }
}

export function getSettings(): Settings {
  const configPath = getConfigPath()
  if (!existsSync(configPath)) return getDefaultSettings()
  try {
    const data = JSON.parse(readFileSync(configPath, 'utf-8'))
    return {
      commitPrefixes: {
        global: data.commitPrefixes?.global ?? [...DEFAULT_COMMIT_PREFIXES],
        projects: data.commitPrefixes?.projects ?? {},
      },
      terminalCommands: {
        global: data.terminalCommands?.global ?? [...DEFAULT_TERMINAL_COMMANDS],
        projects: data.terminalCommands?.projects ?? {},
      },
    }
  } catch {
    return getDefaultSettings()
  }
}

export function saveSettings(settings: Settings): void {
  writeFileSync(getConfigPath(), JSON.stringify(settings, null, 2), 'utf-8')
}

export function getCommitPrefixes(repoPath?: string): string[] {
  const settings = getSettings()
  if (repoPath && settings.commitPrefixes.projects[repoPath]) {
    return settings.commitPrefixes.projects[repoPath]
  }
  return settings.commitPrefixes.global
}

export function getTerminalCommands(repoPath?: string): string[] {
  const settings = getSettings()
  if (repoPath && settings.terminalCommands.projects[repoPath]) {
    return settings.terminalCommands.projects[repoPath]
  }
  return settings.terminalCommands.global
}
