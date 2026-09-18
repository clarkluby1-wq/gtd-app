import { useRef, useState } from 'react'
import { downloadBackup, exportBackup, getLastBackupAt, importBackup } from '../db/backup'
import { ConfirmDialog } from '../components/ConfirmDialog'
import {
  celebrate,
  getCelebrationLevel,
  originOf,
  setCelebrationLevel,
  type CelebrationLevel,
} from '../lib/celebrate'

const CELEBRATION_OPTIONS: { level: CelebrationLevel; label: string; hint: string }[] = [
  { level: 'full', label: 'Full', hint: 'A small confetti burst on every completion; a big one for milestones.' },
  { level: 'subtle', label: 'Subtle', hint: 'A quick check pulse on every completion; confetti only for milestones.' },
  { level: 'off', label: 'Off', hint: 'No effects.' },
]

function formatRelative(ts: number) {
  const days = Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24))
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}

export function SettingsView() {
  const [lastBackupAt, setLastBackupAt] = useState(getLastBackupAt())
  const [importError, setImportError] = useState<string | null>(null)
  const [importedOk, setImportedOk] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [celebration, setCelebration] = useState(getCelebrationLevel())
  const fileInputRef = useRef<HTMLInputElement>(null)

  const chooseCelebration = (level: CelebrationLevel, from: Element) => {
    setCelebrationLevel(level)
    setCelebration(level)
    celebrate(originOf(from), 'normal')
  }

  const handleExport = async () => {
    const json = await exportBackup()
    downloadBackup(json)
    setLastBackupAt(getLastBackupAt())
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
          A little reward when you finish something. Milestones are clearing today's Big Three or finishing a
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
        <div className="mb-2 font-medium text-neutral-100">Backup</div>
        <p className="mb-3 text-sm text-neutral-500">
          {lastBackupAt
            ? `Last backup: ${formatRelative(lastBackupAt)}.`
            : "You haven't backed up yet."}
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
