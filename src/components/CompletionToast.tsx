import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db/db'
import { createAction, reopenAction } from '../db/operations'
import { parseLocalDate } from '../lib/date'
import type { Action, ActionStatus } from '../db/types'

type FollowUpType = 'next' | 'waiting' | 'someday' | 'scheduled'

const TYPES: { key: FollowUpType; label: string; status: ActionStatus }[] = [
  { key: 'next', label: 'Next Action', status: 'next' },
  { key: 'waiting', label: 'Waiting For', status: 'waiting' },
  { key: 'someday', label: 'Someday', status: 'someday' },
  { key: 'scheduled', label: 'Scheduled', status: 'scheduled' },
]

export function CompletionToast({
  completedAction,
  onDismiss,
}: {
  completedAction: Action
  onDismiss: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [title, setTitle] = useState('')
  const [type, setType] = useState<FollowUpType>('next')
  const [contextId, setContextId] = useState('')
  const [waitingOn, setWaitingOn] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const contexts = useLiveQuery(() => db.contexts.orderBy('order').toArray())

  /** Marked done by mistake — put it back exactly where it was and close the toast. */
  const undo = () => {
    void reopenAction(completedAction.id)
    onDismiss()
  }

  const submit = async () => {
    if (!title.trim()) return
    const status = TYPES.find((t) => t.key === type)!.status
    await createAction({
      title: title.trim(),
      projectId: completedAction.projectId,
      status,
      contextId: type === 'next' ? contextId || undefined : undefined,
      waitingOn: type === 'waiting' ? waitingOn.trim() || undefined : undefined,
      scheduledDate: type === 'scheduled' && scheduledDate ? parseLocalDate(scheduledDate) : undefined,
    })
    onDismiss()
  }

  return (
    <div className="w-80 rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-neutral-100 shadow-xl">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="text-sm">
          <span className="text-emerald-400">✓ Done:</span> {completedAction.title}
        </div>
        <button onClick={undo} title="Undo — wasn't actually done" className="shrink-0 text-neutral-600 hover:text-red-400">
          ✕
        </button>
      </div>

      {!expanded ? (
        <div className="flex flex-col gap-2">
          <button
            onClick={onDismiss}
            className="w-full rounded-md bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-700"
          >
            No Further Action
          </button>
          <button
            onClick={() => setExpanded(true)}
            className="w-full rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
          >
            + Add follow-up
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What's next?"
            className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-sm outline-none"
          />

          <div className="flex gap-1">
            {TYPES.map((t) => (
              <button
                key={t.key}
                onClick={() => setType(t.key)}
                className={`flex-1 rounded-md px-2 py-1 text-xs font-medium ${
                  type === t.key ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {type === 'next' && (
            <select
              value={contextId}
              onChange={(e) => setContextId(e.target.value)}
              className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-xs text-neutral-300 outline-none"
            >
              <option value="">No context</option>
              {contexts?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}

          {type === 'waiting' && (
            <input
              value={waitingOn}
              onChange={(e) => setWaitingOn(e.target.value)}
              placeholder="Waiting on whom?"
              className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-xs outline-none"
            />
          )}

          {type === 'scheduled' && (
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-xs outline-none"
            />
          )}

          <div className="flex justify-between pt-1">
            <button onClick={onDismiss} className="text-xs text-neutral-500 hover:text-neutral-300">
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={!title.trim()}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
