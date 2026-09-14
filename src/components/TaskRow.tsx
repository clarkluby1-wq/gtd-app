import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { completeAction, deleteAction, reopenAction } from '../db/operations'
import type { Action } from '../db/types'

function formatDate(ts?: number) {
  if (!ts) return undefined
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function TaskRow({ action, showProject }: { action: Action; showProject?: boolean }) {
  const context = useLiveQuery(() => (action.contextId ? db.contexts.get(action.contextId) : undefined), [
    action.contextId,
  ])
  const project = useLiveQuery(() => (action.projectId ? db.projects.get(action.projectId) : undefined), [
    action.projectId,
  ])

  const done = action.status === 'done'

  return (
    <div className="group flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-neutral-900">
      <button
        onClick={() => (done ? reopenAction(action.id) : completeAction(action.id))}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs transition ${
          done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-neutral-600 hover:border-emerald-500'
        }`}
      >
        {done ? '✓' : ''}
      </button>

      <div className="min-w-0 flex-1">
        <div className={`truncate text-sm ${done ? 'text-neutral-500 line-through' : 'text-neutral-100'}`}>
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
      </div>

      <button
        onClick={() => deleteAction(action.id)}
        className="shrink-0 text-neutral-600 opacity-0 hover:text-red-400 group-hover:opacity-100"
        title="Delete"
      >
        ✕
      </button>
    </div>
  )
}
