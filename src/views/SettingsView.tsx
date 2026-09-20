import { useRef, useState } from 'react'
import { backupAgeLabel, createBackup, getLastBackup, importBackup, isBackupDue } from '../db/backup'
import { ConfirmDialog } from '../components/ConfirmDialog'
import {
  celebrate,
  getCelebrationLevel,
  originOf,
  setCelebrationLevel,
  type CelebrationLevel,
} from '../lib/celebrate'
import { getRemindersEnabled, setRemindersEnabled } from '../lib/reminders'

const CELEBRATION_OPTIONS: { level: CelebrationLevel; label: string; hint: string }[] = [
  { level: 'full', label: 'Full', hint: 'A small confetti burst on every completion; a big one for milestones.' },
  { level: 'subtle', label: 'Subtle', hint: 'A quick check pulse on every completion; confetti only for milestones.' },
  { level: 'off', label: 'Off', hint: 'No effects.' },
]

export function SettingsView() {
  const [lastBackup, setLastBackup] = useState(getLastBackup())
  const [importError, setImportError] = useState<string | null>(null)
  const [importedOk, setImportedOk] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [celebration, setCelebration] = useState(getCelebrationLevel())
  const [reminders, setReminders] = useState(getRemindersEnabled())
  const fileInputRef = useRef<HTMLInputElement>(null)

  const chooseCelebration = (level: CelebrationLevel, from: Element) => {
    setCelebrationLevel(level)
    setCelebration(level)
    celebrate(originOf(from), 'normal')
  }

  const handleExport = async () => {
    await createBackup()
    setLastBackup(getLastBackup())
  }

  const handleImportFile = async (file: File) => {
    setImportError(null)
    setImportedOk(false)
    try {
      const text = await file.text()
      await importBackup(text)
      setImportedOk(true)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Could not read that file.')
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-1 text-xl font-semibold text-neutral-100">Settings</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Everything lives only in this browser. Back up regularly, especially before clearing site data or
        switching browsers/devices.
      </p>

      <div className="mb-6 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <div className="mb-2 font-medium text-neutral-100">Celebrations</div>
        <p className="mb-3 text-sm text-neutral-500">
          A little reward when you finish something. Milestones are clearing today's Short List or finishing a
          project's last open step. Stored on this device only, and it respects your system's reduced-motion
          setting.
        </p>
        <div className="flex gap-2">
          {CELEBRATION_OPTIONS.map((o) => (
            <button
              key={o.level}
              onClick={(e) => chooseCelebration(o.level, e.currentTarget)}
              title={o.hint}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                celebration === o.level
                  ? 'bg-emerald-600 text-white'
                  : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-neutral-600">
          {CELEBRATION_OPTIONS.find((o) => o.level === celebration)?.hint}
        </p>
      </div>

      <div className="mb-6 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <div className="mb-2 font-medium text-neutral-100">Calendar reminders</div>
        <p className="mb-3 text-sm text-neutral-500">
          A pop-up the day before a calendar item, with an option to be reminded again on the day. It can only
          appear while the app is open in a browser tab, so it also shows up late if you weren't in the app the
          day before. Recurring items don't trigger it.
        </p>
        <div className="flex gap-2">
          {[
            { on: true, label: 'On' },
            { on: false, label: 'Off' },
          ].map((o) => (
            <button
              key={o.label}
              onClick={() => {
                setRemindersEnabled(o.on)
                setReminders(o.on)
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                reminders === o.on ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <div className="mb-2 font-medium text-neutral-100">Backup</div>
        <p className={`mb-1 text-sm ${isBackupDue(lastBackup?.at ?? null) ? 'text-amber-400' : 'text-neutral-500'}`}>
          {lastBackup
            ? `Last backup: ${backupAgeLabel(lastBackup.at)}${lastBackup.filename ? ` (${lastBackup.filename})` : ''}.`
            : "You haven't backed up yet."}
          {isBackupDue(lastBackup?.at ?? null) && ' A fresh one is due.'}
        </p>
        <p className="mb-3 text-xs text-neutral-600">
          Your browser saves it to your Downloads folder unless you told it to ask where. It's worth checking the file
          is there — the app can't see it once it's downloaded.
        </p>
        <button
          onClick={handleExport}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
        >
          Download backup (.json)
        </button>
      </div>

      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <div className="mb-2 font-medium text-neutral-100">Restore</div>
        <p className="mb-3 text-sm text-amber-400">
          This replaces everything currently in the app with the contents of the file. There's no undo.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) setPendingFile(file)
            e.target.value = ''
          }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="rounded-md bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-red-600 hover:text-white"
        >
          Restore from file…
        </button>
        {importedOk && (
          <p className="mt-2 flex items-center gap-2 text-xs text-emerald-400">
            Restored.
            <button onClick={() => window.location.reload()} className="underline hover:text-emerald-300">
              Reload now to see it everywhere
            </button>
          </p>
        )}
        {importError && <p className="mt-2 text-xs text-red-400">{importError}</p>}
      </div>

      {pendingFile && (
        <ConfirmDialog
          title="Restore from backup?"
          message={`Replace everything currently in the app with the contents of "${pendingFile.name}"? This can't be undone.`}
          confirmLabel="Restore"
          onConfirm={() => {
            const file = pendingFile
            setPendingFile(null)
            void handleImportFile(file)
          }}
          onCancel={() => setPendingFile(null)}
        />
      )}
    </div>
  )
}
