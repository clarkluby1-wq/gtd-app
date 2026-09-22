import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db/db'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { createVision, deleteVision, updateVision } from '../db/horizons'

export function VisionView() {
  const visions = useLiveQuery(() => db.visions.orderBy('createdAt').toArray())
  const areas = useLiveQuery(() => db.areasOfFocus.orderBy('order').toArray())

  const [creating, setCreating] = useState(false)
  const [statement, setStatement] = useState('')
  const [areaOfFocusId, setAreaOfFocusId] = useState<string>('')

  const areaName = (id?: string) => areas?.find((a) => a.id === id)?.name

  const create = async () => {
    if (!statement.trim()) return
    await createVision({ statement: statement.trim(), areaOfFocusId: areaOfFocusId || undefined })
    setStatement('')
    setAreaOfFocusId('')
    setCreating(false)
  }

  const overarching = visions?.filter((v) => !v.areaOfFocusId) ?? []
  const perArea = visions?.filter((v) => v.areaOfFocusId) ?? []

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-100">Vision</h1>
        <button
          onClick={() => setCreating((v) => !v)}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
        >
          + Add Vision
        </button>
      </div>
      <p className="mb-6 text-sm text-neutral-500">
        Horizon 4 (40,000 ft) — picture your life, or a specific area of it, 3-5 years from now if things go
        wildly well. Vivid and specific beats vague.
      </p>

      {creating && (
        <div className="mb-6 flex flex-col gap-2 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <textarea
            autoFocus
            value={statement}
            onChange={(e) => setStatement(e.target.value)}
            rows={3}
            placeholder="If this went wildly well, 3-5 years from now it would look like…"
            className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
          />
          <select
            value={areaOfFocusId}
            onChange={(e) => setAreaOfFocusId(e.target.value)}
            className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
          >
            <option value="">Whole-life vision (no specific area)</option>
            {areas?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <button
            onClick={create}
            className="self-start rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
          >
            Save
          </button>
        </div>
      )}

      {!!overarching.length && (
        <>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-neutral-600">Whole Life</h2>
          <div className="mb-6 flex flex-col gap-2">
            {overarching.map((v) => (
              <VisionRow
                key={v.id}
                statement={v.statement}
                onSave={(next) => updateVision(v.id, { statement: next })}
                onDelete={() => deleteVision(v.id)}
              />
            ))}
          </div>
        </>
      )}

      {!!perArea.length && (
        <>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-neutral-600">By Area of Focus</h2>
          <div className="flex flex-col gap-2">
            {perArea.map((v) => (
              <VisionRow
                key={v.id}
                statement={v.statement}
                areaName={areaName(v.areaOfFocusId)}
                onSave={(next) => updateVision(v.id, { statement: next })}
                onDelete={() => deleteVision(v.id)}
              />
            ))}
          </div>
        </>
      )}

      {visions?.length === 0 && !creating && (
        <div className="rounded-lg border border-dashed border-neutral-800 p-8 text-center text-sm text-neutral-500">
          No vision defined yet.
        </div>
      )}
    </div>
  )
}

function VisionRow({
  statement,
  areaName,
  onSave,
  onDelete,
}: {
  statement: string
  areaName?: string
  onSave: (next: string) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(statement)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  return (
    <div className="group rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <div className="mb-1 flex items-center justify-between">
        {areaName && <span className="text-xs text-emerald-400">{areaName}</span>}
        <button
          onClick={() => setConfirmingDelete(true)}
          className="touch-reveal text-neutral-600 hover:text-red-400"
        >
          ✕
        </button>
      </div>
      {editing ? (
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            setEditing(false)
            onSave(draft)
          }}
          rows={3}
          className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm outline-none"
        />
      ) : (
        <p onClick={() => setEditing(true)} className="flex items-start gap-1.5 cursor-pointer text-sm text-neutral-200 hover:text-neutral-100">
          <span>{statement}</span>
          <span className="shrink-0 text-xs text-neutral-600" aria-hidden>
            ✏️
          </span>
        </p>
      )}

      {confirmingDelete && (
        <ConfirmDialog
          message="Delete this vision? This can't be undone."
          onConfirm={() => {
            onDelete()
            setConfirmingDelete(false)
          }}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  )
}
