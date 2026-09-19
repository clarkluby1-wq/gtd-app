import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { db } from '../db/db'
import { completeProject, createAction, reopenAction } from '../db/operations'
import { celebrate, getCelebrationLevel, originOf } from '../lib/celebrate'
import { celebrateCompletion, isLastOpenAction } from '../lib/celebrateCompletion'
import { parseLocalDate, startOfToday } from '../lib/date'
import type { Action, ActionStatus } from '../db/types'

const PHRASES = ['Nice.', 'One down.', 'Momentum.', 'Progress counts.', "That's a win.", 'Done and dusted.']

type FollowUpType = 'next' | 'waiting' | 'someday' | 'scheduled'

const TYPES: { key: FollowUpType; label: string; status: ActionStatus }[] = [
  { key: 'next', label: 'Next Action', status: 'next' },
  { key: 'waiting', label: 'Waiting For', status: 'waiting' },
  { key: 'someday', label: 'Someday', status: 'someday' },
  { key: 'scheduled', label: 'Scheduled', status: 'scheduled' },
]

export function CompletionToast({
  completedAction,
  celebrateOnDismiss,
  nudgeCount,
  onDismiss,
}: {
  completedAction: Action
  /** The reward was held back at completion; give it now that the "what's next?" prompt is answered. */
  celebrateOnDismiss: boolean
  /** How many times someone tried to mark something else done while this card was still open. */
  nudgeCount: number
  onDismiss: () => void
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [title, setTitle] = useState('')
  const [type, setType] = useState<FollowUpType>('next')
  const [contextId, setContextId] = useState('')
  const [waitingOn, setWaitingOn] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const contexts = useLiveQuery(() => db.contexts.orderBy('order').toArray())
  const [phrase] = useState(() => PHRASES[Math.floor(Math.random() * PHRASES.length)])
  const doneToday = useLiveQuery(() =>
    db.actions
      .where('status')
      .equals('done')
      .filter((a) => (a.completedAt ?? 0) >= startOfToday())
      .count(),
  )
  const projectFinished = useLiveQuery(() => isLastOpenAction(completedAction), [completedAction.id])
  const projectId = completedAction.projectId
  const showAcknowledgement = getCelebrationLevel() !== 'off' && doneToday !== undefined

  // A blocked completion attempt shakes the card (or, for reduced motion, flashes its outline) so it's clear why nothing happened.
  useEffect(() => {
    if (nudgeCount === 0) return
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    cardRef.current?.animate(
      calm
        ? [
            { boxShadow: '0 0 0 0 rgba(251,191,36,0)' },
            { boxShadow: '0 0 0 4px rgba(251,191,36,0.8)' },
            { boxShadow: '0 0 0 0 rgba(251,191,36,0)' },
          ]
        : [
            { transform: 'translateX(0)' },
            { transform: 'translateX(-7px)' },
            { transform: 'translateX(7px)' },
            { transform: 'translateX(-4px)' },
            { transform: 'translateX(0)' },
          ],
      { duration: 320 },
    )
  }, [nudgeCount])

  /** Marked done by mistake — put it back exactly where it was and close the toast. */
  const undo = () => {
    void reopenAction(completedAction.id)
    onDismiss()
  }

  /** Answering the prompt (any way but Undo) closes the toast, and is when a held-back reward finally fires. */
  const closeWithReward = (from: Element) => {
    if (celebrateOnDismiss) void celebrateCompletion(completedAction, from)
    onDismiss()
  }

  const submit = async (from: Element) => {
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
    closeWithReward(from)
  }

  return (
    <div
      ref={cardRef}
      className="w-80 rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-neutral-100 shadow-xl"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="text-sm">
          <span className="text-emerald-400">✓ Done:</span> {completedAction.title}
        </div>
        <button onClick={undo} title="Undo — wasn't actually done" className="shrink-0 text-neutral-600 hover:text-red-400">
          ✕
        </button>
      </div>

      {showAcknowledgement && (
        <div className="-mt-1 mb-3 text-xs text-neutral-500">
          {phrase} · {doneToday} done today
        </div>
      )}

      {nudgeCount > 0 && (
        <div className="mb-3 text-xs text-amber-400">Answer this first — then you can mark the next one done.</div>
      )}

      {!expanded ? (
        <div className="flex flex-col gap-2">
          {projectFinished && projectId && (
            <button
              onClick={(e) => {
                celebrate(originOf(e.currentTarget), 'big')
                void completeProject(projectId)
                onDismiss()
              }}
              className="w-full rounded-md bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500 hover:text-neutral-950"
            >
              ✓ Nothing else open — mark project complete
            </button>
          )}
          <button
            onClick={(e) => closeWithReward(e.currentTarget)}
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
            <button
              onClick={(e) => closeWithReward(e.currentTarget)}
              className="text-xs text-neutral-500 hover:text-neutral-300"
            >
              Cancel
            </button>
            <button
              onClick={(e) => void submit(e.currentTarget)}
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
