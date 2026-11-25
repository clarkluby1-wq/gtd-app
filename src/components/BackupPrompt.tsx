import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { backupAgeLabel, createBackup, getLastBackupAt, isBackupDue } from '../db/backup'
import { db } from '../db/db'
import { startOfToday } from '../lib/date'

const ASK_AGAIN_KEY = 'gtd.backup.askAgainAt'
const DAY = 24 * 60 * 60 * 1000

function askedAgainLater(): boolean {
  try {
    return Number(localStorage.getItem(ASK_AGAIN_KEY) ?? 0) > Date.now()
  } catch {
    return false
  }
}

/**
 * A slim bar, under the capture box, asking for a backup every third day. A backup can only be saved by you (the
 * browser decides where the file goes), so the app can't do it silently — this makes it one tap. "Tomorrow" just
 * asks again the next day; it never blocks anything, and it's quiet when a backup is fresh or there's nothing to save.
 */
export function BackupPrompt() {
  const [last, setLast] = useState(getLastBackupAt)
  const [later, setLater] = useState(askedAgainLater)
  const [justDone, setJustDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const hasData = useLiveQuery(async () => (await db.actions.count()) + (await db.projects.count()) > 0)

  useEffect(() => {
    if (!justDone) return
    const t = setTimeout(() => setJustDone(false), 3500)
    return () => clearTimeout(t)
  }, [justDone])

  if (justDone) {
    return (
      <div role="status" className="border-b border-neutral-800 bg-emerald-950/30 px-4 py-2 text-xs text-emerald-300">
        ✓ Backed up. Your backup file is in your Downloads folder.
      </div>
    )
  }
  if (!hasData || later || !isBackupDue(last)) return null

  const backUp = async () => {
    setBusy(true)
    try {
      await createBackup()
      setLast(getLastBackupAt())
      setJustDone(true)
    } finally {
      setBusy(false)
    }
  }

  const tomorrow = () => {
    try {
      localStorage.setItem(ASK_AGAIN_KEY, String(startOfToday() + DAY))
    } catch {
      // It'll just ask again next time the app opens.
    }
    setLater(true)
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-neutral-800 bg-neutral-900 px-4 py-2 text-xs">
      <span className="text-neutral-300">
        {last === null ? "You haven't backed up yet." : `Last backup: ${backupAgeLabel(last)}.`} Save a safe copy now?
      </span>
      <span className="flex items-center gap-3">
        <button
          onClick={() => void backUp()}
          disabled={busy}
          className="rounded-full bg-emerald-600 px-3 py-1 font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
        >
          Yes, back up now
        </button>
        <button onClick={tomorrow} className="text-neutral-500 hover:text-neutral-300">
          Tomorrow
        </button>
      </span>
    </div>
  )
}
