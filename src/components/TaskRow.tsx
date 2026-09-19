import type { DraggableAttributes } from '@dnd-kit/core'
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities'
import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type ReactNode } from 'react'
import { db } from '../db/db'
import { completeAction, deleteAction, pinToBigThree, reopenAction, unpinFromBigThree } from '../db/operations'
import { celebrateCompletion } from '../lib/celebrateCompletion'
import { useCompletionToast } from '../lib/completionToastContext'
import { formatShortDate, startOfToday } from '../lib/date'
import { ageInDays, ageLabel } from '../lib/staleness'
import { lastContactAt, waitingStartedAt } from '../lib/waiting'
import type { Action } from '../db/types'
import { ConfirmDialog } from './ConfirmDialog'
import { EditActionModal } from './EditActionModal'

function formatDate(ts?: number) {
  if (!ts) return undefined
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** "waiting 9 days · followed up 2 days ago". Turns amber once it's been a week since anyone made contact. */
function WaitingClock({ action }: { action: Action }) {
  const waited = ageInDays(waitingStartedAt(action))
  const lastFollowUp = action.followUps?.[action.followUps.length - 1]
  const quiet = ageInDays(lastContactAt(action))
  return (
    <>
      <span className={quiet > 7 ? 'text-amber-500' : undefined} title={`Waiting since ${formatShortDate(waitingStartedAt(action))}`}>
        waiting {ageLabel(waited)}
      </span>
      {lastFollowUp !== undefined && (
        <span title={`Last followed up ${formatShortDate(lastFollowUp)}`}>
          followed up {ageInDays(lastFollowUp) === 0 ? 'today' : `${ageLabel(ageInDays(lastFollowUp))} ago`}
        </span>
      )}
    </>
  )
}

export function TaskRow({
  action,
  showProject,
  showWaitingClock,
  extraAction,
  dragHandle,
  showBigThreePin,
  pinnedTodayCount,
  onOpenProject,
}: {
  action: Action
  showProject?: boolean
  /** On a Waiting For row: how long the wait has run, and when you last followed up. */
  showWaitingClock?: boolean
  /** An extra control shown at the end of the row, before delete. */
  extraAction?: ReactNode
  /** Passed by a sortable wrapper to enable drag-to-reorder; omit to render no handle. */
  dragHandle?: { attributes: DraggableAttributes; listeners: SyntheticListenerMap | undefined }
  /** Show the Big Three pin toggle. Only meaningful in the Next Actions view — that's the one trusted list it pins from. */
  showBigThreePin?: boolean
  /** How many actions are pinned for today, to enforce the 3-item cap. Only used when showBigThreePin is true. */
  pinnedTodayCount?: number
  /** Makes the "↳ Project" badge (when showProject is set) clickable, jumping into that project. */
  onOpenProject?: (projectId: string) => void
}) {
  const context = useLiveQuery(() => (action.contextId ? db.contexts.get(action.contextId) : undefined), [
    action.contextId,
  ])
  const project = useLiveQuery(() => (action.projectId ? db.projects.get(action.projectId) : undefined), [
    action.projectId,
  ])
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const { notify } = useCompletionToast()

  const done = action.status === 'done'
  const pinnedToday = action.bigThreeDate === startOfToday()
  const atCap = (pinnedTodayCount ?? 0) >= 3

  return (
    <div className="group flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-neutral-900">
      {dragHandle && (
        <button
          {...dragHandle.attributes}
          {...dragHandle.listeners}
          style={{ touchAction: 'none' }}
          className="shrink-0 cursor-grab text-neutral-600 opacity-0 hover:text-neutral-300 group-hover:opacity-100 active:cursor-grabbing"
          title="Drag to reorder"
        >
          ⠿
        </button>
      )}
      <button
        onClick={(e) => {
          if (done) {
            reopenAction(action.id)
          } else {
            completeAction(action.id)
            notify(action)
            void celebrateCompletion(action, e.currentTarget)
          }
        }}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs transition ${
          done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-neutral-600 hover:border-emerald-500'
        }`}
      >
        {done ? '✓' : ''}
      </button>

      {showBigThreePin && (
        <button
          onClick={() => (pinnedToday ? unpinFromBigThree(action.id) : pinToBigThree(action.id))}
          disabled={!pinnedToday && atCap}
          title={
            pinnedToday
              ? "Remove from today's Big Three"
              : atCap
                ? "Today's Big Three is full — remove one first"
                : "Pin as one of today's Big Three"
          }
          className={`shrink-0 text-sm transition disabled:cursor-not-allowed disabled:opacity-20 ${
            pinnedToday
              ? 'text-amber-400'
              : 'text-neutral-700 opacity-0 hover:text-amber-400 group-hover:opacity-100'
          }`}
        >
          {pinnedToday ? '★' : '☆'}
        </button>
      )}

      <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setEditing(true)}>
        <div className={`truncate text-sm hover:underline ${done ? 'text-neutral-500 line-through' : 'text-neutral-100'}`}>
          {action.recurringTemplateId && <span title="Recurring">🔁 </span>}
          {action.title}
        </div>
        <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-neutral-500">
          {/* Context/energy/time only mean something while this is an actionable Next Action — EditActionModal
              keeps them in the record when you switch tabs so they aren't lost, but they shouldn't visually
              leak onto a Waiting For / Someday / Scheduled row and imply this is currently engageable. */}
          {action.status === 'next' && context && (
            <span className="rounded bg-neutral-800 px-1.5 py-0.5">{context.name}</span>
          )}
          {action.status === 'next' && action.energy && <span>⚡ {action.energy}</span>}
          {action.status === 'next' && action.timeEstimateMin != null && <span>⏱ {action.timeEstimateMin}m</span>}
          {action.dueDate && <span className="text-amber-500">due {formatDate(action.dueDate)}</span>}
          {action.status === 'scheduled' && action.scheduledDate && (
            <span className="text-sky-400">{formatDate(action.scheduledDate)}</span>
          )}
          {action.status === 'waiting' && action.waitingOn && <span>waiting on {action.waitingOn}</span>}
          {showWaitingClock && action.status === 'waiting' && <WaitingClock action={action} />}
          {showProject && project && (
            onOpenProject ? (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onOpenProject(project.id)
                }}
                className="text-neutral-400 hover:text-emerald-400 hover:underline"
              >
                ↳ {project.title}
              </button>
            ) : (
              <span className="text-neutral-400">↳ {project.title}</span>
            )
          )}
        </div>

        {action.notes && (
          <div className="mt-1">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setExpanded((v) => !v)
              }}
              className="text-xs text-neutral-500 hover:text-neutral-300"
            >
              {expanded ? '▾' : '▸'} Description
            </button>
            {expanded && (
              <p className="mt-1 whitespace-pre-wrap text-xs text-neutral-400">{action.notes}</p>
            )}
          </div>
        )}
      </div>

      {extraAction}

      <button
        onClick={() => setConfirmingDelete(true)}
        className="shrink-0 text-neutral-600 opacity-0 hover:text-red-400 group-hover:opacity-100"
        title="Delete"
      >
        ✕
      </button>

      {editing && <EditActionModal action={action} onClose={() => setEditing(false)} />}

      {confirmingDelete && (
        <ConfirmDialog
          message={`Delete "${action.title}"? This can't be undone.`}
          onConfirm={() => {
            deleteAction(action.id)
            setConfirmingDelete(false)
          }}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  )
}
