import type { DraggableAttributes } from '@dnd-kit/core'
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities'
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db/db'
import { completeAction, deleteAction, reopenAction } from '../db/operations'
import { useCompletionToast } from '../lib/completionToastContext'
import type { Action } from '../db/types'
import { ConfirmDialog } from './ConfirmDialog'
import { EditActionModal } from './EditActionModal'

function formatDate(ts?: number) {
  if (!ts) return undefined
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function TaskRow({
  action,
  showProject,
  dragHandle,
}: {
  action: Action
  showProject?: boolean
  /** Passed by a sortable wrapper to enable drag-to-reorder; omit to render no handle. */
  dragHandle?: { attributes: DraggableAttributes; listeners: SyntheticListenerMap | undefined }
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
        onClick={() => {
          if (done) {
            reopenAction(action.id)
          } else {
            completeAction(action.id)
            notify(action)
          }
        }}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs transition ${
          done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-neutral-600 hover:border-emerald-500'
        }`}
      >
        {done ? '✓' : ''}
      </button>

      <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setEditing(true)}>
        <div className={`truncate text-sm hover:underline ${done ? 'text-neutral-500 line-through' : 'text-neutral-100'}`}>
          {action.recurringTemplateId && <span title="Recurring">🔁 </span>}
          {action.title}
        </div>
        <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-neutral-500">
          {context && <span className="rounded bg-neutral-800 px-1.5 py-0.5">{context.name}</span>}
          {action.energy && <span>⚡ {action.energy}</span>}
          {action.timeEstimateMin != null && <span>⏱ {action.timeEstimateMin}m</span>}
          {action.dueDate && <span className="text-amber-500">due {formatDate(action.dueDate)}</span>}
          {action.scheduledDate && <span className="text-sky-400">{formatDate(action.scheduledDate)}</span>}
          {action.waitingOn && <span>waiting on {action.waitingOn}</span>}
          {showProject && project && <span className="text-neutral-400">↳ {project.title}</span>}
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
