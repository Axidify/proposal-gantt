export interface RecentFileEntry {
  path: string
  title: string
  updatedAt: string
}

const STORAGE_KEY = 'proposal-gantt:recent-files'
const MAX_RECENT = 8

function readEntries(): RecentFileEntry[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as RecentFileEntry[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeEntries(entries: RecentFileEntry[]): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_RECENT)))
}

export function listRecentFiles(): RecentFileEntry[] {
  return readEntries()
}

export function addRecentFile(path: string, title: string): RecentFileEntry[] {
  const normalizedPath = path.trim()
  if (!normalizedPath) return readEntries()

  const entry: RecentFileEntry = {
    path: normalizedPath,
    title: title.trim() || 'Untitled Proposal',
    updatedAt: new Date().toISOString()
  }

  const next = [entry, ...readEntries().filter((item) => item.path !== normalizedPath)]
  writeEntries(next)
  return next.slice(0, MAX_RECENT)
}

export function removeRecentFile(path: string): RecentFileEntry[] {
  const next = readEntries().filter((item) => item.path !== path)
  writeEntries(next)
  return next
}

export function recentFileLabel(path: string): string {
  const parts = path.split(/[/\\]/)
  return parts[parts.length - 1] || path
}
