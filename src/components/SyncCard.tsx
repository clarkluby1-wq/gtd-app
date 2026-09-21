import { useState } from 'react'
import { backupAgeLabel, createBackup, getLastBackup, isBackupDue } from '../db/backup'
import { db } from '../db/db'
import { useSync } from '../lib/useSync'
import { ConfirmDialog } from './ConfirmDialog'

/** Sign in to keep the same data on every device. Only appears once a cloud database has been set up. */
export function SyncCard() {
  const sync = useSync()
  const [lastBackup, setLastBackup] = useState(getLastBackup())
  const [confirmingSignOut, setConfirmingSignOut] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  if (!sync.enabled) return null

  const signIn = async () => {
    setProblem(null)
    try {
      await db.cloud.login()
    } catch (err) {
      // Closing the sign-in box is fine; anything else is worth saying.
      const message = err instanceof Error ? err.message : ''
      if (message && !/cancel/i.test(message)) setProblem(message)
    }
  }

  const syncNow = async () => {
    setProblem(null)
    try {
      await db.cloud.sync({ purpose: 'push', wait: false })
      await db.cloud.sync({ purpose: 'pull', wait: false })
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'Could not sync.')
    }
  }

  const signOut = async () => {
    setConfirmingSignOut(false)
    setProblem(null)
    try {
      await db.cloud.logout()
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'Could not sign out.')
    }
  }

  const dot =
    sync.kind === 'synced' ? 'bg-emerald-500' : sync.kind === 'error' ? 'bg-red-500' : sync.kind === 'offline' ? 'bg-neutral-500' : 'bg-amber-400'

  return (
    <div className="mb-6 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <div className="mb-2 font-medium text-neutral-100">Sync between devices</div>

      {sync.signedIn ? (
        <>
          <p className="mb-1 text-sm text-neutral-300">
            Signed in{sync.email ? ` as ${sync.email}` : ''}. Your data is the same on every device you sign in on.
          </p>
          <p className="mb-3 flex items-center gap-2 text-sm text-neutral-400">
            <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden />
            {sync.label}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void syncNow()}
              className="rounded-md bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-700"
            >
              Sync now
            </button>
            <button
              onClick={() => setConfirmingSignOut(true)}
              className="rounded-md bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-700"
            >
              Sign out…
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mb-3 text-sm text-neutral-400">
            Keep your data the same on your computer and your phone. Sign in with your email and you'll be sent a code —
            no password. Your data is stored with Dexie Cloud, a sync service, and is private to your sign-in. The app still
            works with no signal, and catches up later.
          </p>
          <p className="mb-3 text-xs text-neutral-500">
            {lastBackup
              ? `Last backup: ${backupAgeLabel(lastBackup.at)}.`
              : "You haven't downloaded a backup yet."}
            {isBackupDue(lastBackup?.at ?? null) && ' Worth getting a fresh one before you turn sync on.'}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void signIn()}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
            >
              Sign in to sync
            </button>
            <button
              onClick={async () => {
                await createBackup()
                setLastBackup(getLastBackup())
              }}
              className="rounded-md bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-700"
            >
              Download a backup first
            </button>
          </div>
        </>
      )}

      {problem && <p className="mt-2 text-xs text-red-400">{problem}</p>}

      {confirmingSignOut && (
        <ConfirmDialog
          title="Sign out of sync?"
          message="This removes your data from this device. It stays safe in the cloud, and comes straight back when you sign in again. Anything not yet synced will be asked about first."
          confirmLabel="Sign out"
          onConfirm={() => void signOut()}
          onCancel={() => setConfirmingSignOut(false)}
        />
      )}
    </div>
  )
}
