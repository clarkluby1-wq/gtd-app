import { db } from './db'

const BACKUP_VERSION = 1
const LAST_BACKUP_KEY = 'gtd-app:last-backup-at'
const LAST_BACKUP_FILE_KEY = 'gtd-app:last-backup-file'

/** A backup this old (or none at all) is worth a gentle nudge — it matches the weekly review rhythm. */
export const BACKUP_DUE_AFTER_DAYS = 7

interface BackupPayload {
  version: number
  exportedAt: number
  tables: Record<string, unknown[]>
}

const TABLE_NAMES = [
  'actions',
  'projects',
  'contexts',
  'areasOfFocus',
  'goals',
  'visions',
  'purposes',
  'references',
  'weeklyReviews',
  'recurringTemplates',
] as const

export async function exportBackup(): Promise<string> {
  const tables: Record<string, unknown[]> = {}
  for (const name of TABLE_NAMES) {
    tables[name] = await db.table(name).toArray()
  }
  const payload: BackupPayload = { version: BACKUP_VERSION, exportedAt: Date.now(), tables }
  return JSON.stringify(payload, null, 2)
}

/** Hands the file to the browser as a normal download and returns its name. */
export function downloadBackup(json: string): string {
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const stamp = new Date().toISOString().slice(0, 10)
  const filename = `gtd-backup-${stamp}.json`
  a.href = url
  a.download = filename
  a.style.display = 'none'
  // Attached to the page while it's clicked (some browsers ignore a detached link), and the file is released a
  // little later rather than instantly, so a slow download isn't cut off.
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return filename
}

/**
 * Remember when a backup file was made — after it was handed to the browser, not before. The app can't see whether
 * the file was actually kept (a Save dialog may have been cancelled), so this is "file created", never "saved".
 */
function recordBackup(filename: string) {
  try {
    localStorage.setItem(LAST_BACKUP_KEY, String(Date.now()))
    localStorage.setItem(LAST_BACKUP_FILE_KEY, filename)
  } catch {
    // The backup itself still happened; only the reminder text is affected.
  }
}

/** Make a backup file now and remember that it was made. */
export async function createBackup(): Promise<{ filename: string; at: number }> {
  const json = await exportBackup()
  const filename = downloadBackup(json)
  recordBackup(filename)
  return { filename, at: getLastBackupAt() ?? Date.now() }
}

/** Replaces all local data with the contents of a previously exported backup. */
export async function importBackup(json: string) {
  const payload = JSON.parse(json) as BackupPayload
  if (!payload?.tables) throw new Error('Not a valid GTD backup file.')

  await db.transaction('rw', TABLE_NAMES.map((name) => db.table(name)), async () => {
    for (const name of TABLE_NAMES) {
      const rows = payload.tables[name]
      // Delete row by row rather than clear(), so the removals are tracked properly when sync is on.
      await db.table(name).toCollection().delete()
      if (Array.isArray(rows) && rows.length) {
        await db.table(name).bulkAdd(rows)
      }
    }
  })
}

export function getLastBackupAt(): number | null {
  const raw = localStorage.getItem(LAST_BACKUP_KEY)
  return raw ? Number(raw) : null
}

export function getLastBackup(): { at: number; filename?: string } | null {
  const at = getLastBackupAt()
  if (at === null) return null
  return { at, filename: localStorage.getItem(LAST_BACKUP_FILE_KEY) ?? undefined }
}

function daysSince(at: number): number {
  return Math.floor((Date.now() - at) / (1000 * 60 * 60 * 24))
}

/** "today", "yesterday", "9 days ago", or "never". */
export function backupAgeLabel(at: number | null): string {
  if (at === null) return 'never'
  const days = daysSince(at)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}

export function isBackupDue(at: number | null): boolean {
  return at === null || daysSince(at) >= BACKUP_DUE_AFTER_DAYS
}
