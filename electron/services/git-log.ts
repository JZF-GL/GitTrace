import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'

export interface GitLogEntry {
  id: string
  timestamp: number
  repoName: string
  repoPath: string
  operation: string
  command: string
  success: boolean
  message: string
  duration?: number
}

const LOG_DIR = join(app.getPath('userData'), 'git-logs')
const LOG_FILE = join(LOG_DIR, 'git-operations.json')
const MAX_LOGS = 1000

function ensureLogDir() {
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true })
  }
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
}

export function addLogEntry(entry: Omit<GitLogEntry, 'id' | 'timestamp'>): void {
  try {
    ensureLogDir()
    
    let logs: GitLogEntry[] = []
    if (existsSync(LOG_FILE)) {
      const data = readFileSync(LOG_FILE, 'utf-8')
      logs = JSON.parse(data)
    }
    
    const newEntry: GitLogEntry = {
      ...entry,
      id: generateId(),
      timestamp: Date.now(),
    }
    
    logs.unshift(newEntry)
    
    // 限制日志数量
    if (logs.length > MAX_LOGS) {
      logs = logs.slice(0, MAX_LOGS)
    }
    
    writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2), 'utf-8')
  } catch (e) {
    console.error('Failed to write git log:', e)
  }
}

export function getLogEntries(limit: number = 100): GitLogEntry[] {
  try {
    ensureLogDir()
    
    if (!existsSync(LOG_FILE)) {
      return []
    }
    
    const data = readFileSync(LOG_FILE, 'utf-8')
    const logs: GitLogEntry[] = JSON.parse(data)
    return logs.slice(0, limit)
  } catch (e) {
    console.error('Failed to read git log:', e)
    return []
  }
}

export function clearLogs(): void {
  try {
    ensureLogDir()
    writeFileSync(LOG_FILE, '[]', 'utf-8')
  } catch (e) {
    console.error('Failed to clear git log:', e)
  }
}
