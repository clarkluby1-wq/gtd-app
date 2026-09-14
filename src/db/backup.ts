import { db } from './db'

const BACKUP_VERSION = 1
const LAST_BACKUP_KEY = 'gtd-app:last-backup-at'

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
  localStorage.setItem(LAST_BACKUP_KEY, String(Date.now()))
  return JSON.stringify(payload, null, 2)
}

export function downloadBackup(json: string) {
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const stamp = new Date().toISOString().slice(0, 10)
  a.href = url
  a.download = `gtd-backup-${stamp}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/** Replaces all local data with the contents of a previously exported backup. */
export async function importBackup(json: string) {
  const payload = JSON.parse(json) as BackupPayload
  if (!payload?.tables) throw new Error('Not a valid GTD backup file.')

  await db.transaction('rw', TABLE_NAMES.map((name) => db.table(name)), async () => {
    for (const name of TABLE_NAMES) {
      const rows = payload.tables[name]
      await db.table(name).clear()
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
