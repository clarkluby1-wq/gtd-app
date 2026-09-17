import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db/db'
import { updateAction } from '../db/operations'
import type { Action, ActionStatus, EnergyLevel } from '../db/types'
import { parseLocalDate } from '../lib/date'

type EditType = 'next' | 'waiting' | 'someday' | 'scheduled'

const TYPES: { key: EditType; label: string; status: ActionStatus }[] = [
  { key: 'next', label: 'Next Action', status: 'next' },
  { key: 'waiting', label: 'Waiting For', status: 'waiting' },
  { key: 'someday', label: 'Someday', status: 'someday' },
  { key: 'scheduled', label: 'Scheduled', status: 'scheduled' },
]

function statusToType(status: ActionStatus): EditType {
  if (status === 'waiting') return 'waiting'
  if (status === 'someday') return 'someday'
  if (status === 'scheduled') return 'scheduled'
  return 'next'
}

function toDateInputValue(ts?: number) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function EditActionModal({ action, onClose }: { action: Action; onClose: () => void }) {
  const contexts = useLiveQuery(() => db.contexts.orderBy('order').toArray())
  const projects = useLiveQuery(() => db.projects.where('status').equals('active').toArray())

  const [title, setTitle] = useState(action.title)
  const [type, setType] = useState<EditType>(statusToType(action.status))
  const [contextId, setContextId] = useState(action.contextId ?? '')
  const [energy, setEnergy] = useState<EnergyLevel | undefined>(action.energy)
  const [timeEstimateMin, setTimeEstimateMin] = useState(action.timeEstimateMin?.toString() ?? '')
  const [dueDate, setDueDate] = useState(toDateInputValue(action.dueDate))
  const [waitingOn, setWaitingOn] = useState(action.waitingOn ?? '')
  const [scheduledDate, setScheduledDate] = useState(toDateInputValue(action.scheduledDate))
  const [projectId, setProjectId] = useState(action.projectId ?? '')
  const [notes, setNotes] = useState(action.notes ?? '')

  const save = async () => {
    const status = TYPES.find((t) => t.key === type)!.status
    await updateAction(action.id, {
      title: title.trim() || action.title,
      status,
      projectId: projectId || undefined,
      contextId: type === 'next' ? contextId || undefined : undefined,
      energy: type === 'next' ? energy : undefined,
      timeEstimateMin: type === 'next' && timeEstimateMin ? Number(timeEstimateMin) : undefined,
      dueDate: type === 'next' && dueDate ? parseLocalDate(dueDate) : undefined,
      waitingOn: type === 'waiting' ? waitingOn.trim() || undefined : undefined,
      scheduledDate: type === 'scheduled' && scheduledDate ? parseLocalDate(scheduledDate) : undefined,
      notes: notes.trim() || undefined,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-neutral-800 bg-neutral-900 text-neutral-100 shadow-xl">
        <div className="border-b border-neutral-800 px-5 py-3 text-xs uppercase tracking-wide text-neutral-500">
          Edit
        </div>

        <div className="flex-1 overflow-y-auto p-5">

        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mb-3 w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm font-medium outline-none"
        />

        <div className="mb-3 flex gap-1">
          {TYPES.map((t) => (
            <button
              key={t.key}
              onClick={() => setType(t.key)}
              className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium ${
                type === t.key ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <label className="text-xs text-neutral-500">Description — notes, correspondence, backup detail</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Optional — paste relevant context here, keep the title itself scannable"
            className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
          />

          {type === 'next' && (
            <>
              <label className="text-xs text-neutral-500">Context</label>
              <select
                value={contextId}
                onChange={(e) => setContextId(e.target.value)}
                className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
              >
                <option value="">No context</option>
                {contexts?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <label className="text-xs text-neutral-500">Energy required</label>
              <div className="flex gap-2">
                {(['low', 'medium', 'high'] as EnergyLevel[]).map((e) => (
                  <button
                    key={e}
                    onClick={() => setEnergy(energy === e ? undefined : e)}
                    className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
                      energy === e ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-200'
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>

              <label className="text-xs text-neutral-500">Time estimate (minutes)</label>
              <input
                type="number"
                min={0}
                value={timeEstimateMin}
                onChange={(e) => setTimeEstimateMin(e.target.value)}
                className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
              />

              <label className="text-xs text-neutral-500">Due date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
              />
            </>
          )}

          {type === 'waiting' && (
            <>
              <label className="text-xs text-neutral-500">Waiting on whom?</label>
              <input
                value={waitingOn}
                onChange={(e) => setWaitingOn(e.target.value)}
                className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
              />
            </>
          )}

          {type === 'scheduled' && (
            <>
              <label className="text-xs text-neutral-500">Scheduled date</label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
              />
            </>
          )}

          <label className="text-xs text-neutral-500">Project</label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
          >
            <option value="">No project</option>
            {projects?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>
        </div>

        <div className="flex justify-between border-t border-neutral-800 px-5 py-3">
          <button onClick={onClose} className="text-xs text-neutral-500 hover:text-neutral-300">
            Cancel
          </button>
          <button
            onClick={save}
            className="rounded-md bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
