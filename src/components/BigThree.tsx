import { TaskRow } from './TaskRow'
import type { Action } from '../db/types'

/** Today's pinned focus items. Shared by the Dashboard and What Now?, so it always reads the same in both. */
export function BigThree({
  actions,
  onViewNextActions,
  onOpenProject,
}: {
  actions: Action[]
  onViewNextActions: () => void
  onOpenProject: (id: string) => void
}) {
  return (
    <div className="mb-6 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <div className="mb-3 flex items-center gap-1.5">
        <h2 className="text-sm font-medium text-neutral-300">Today's Big Three</h2>
        <span
          title="Up to three things you're committed to today, pinned from Next Actions. Not a new list — just a focus flag. Whatever's left unfinished quietly stops being pinned at midnight, no guilt."
          className="cursor-help text-xs text-neutral-500 hover:text-neutral-300"
        >
          ⓘ
        </span>
      </div>

      {actions.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Nothing pinned yet.{' '}
          <button onClick={onViewNextActions} className="text-emerald-400 hover:text-emerald-300">
            Pin up to three from Next Actions →
          </button>
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-neutral-900">
          {actions.map((a) => (
            <TaskRow
              key={a.id}
              action={a}
              showProject
              showBigThreePin
              pinnedTodayCount={actions.length}
              onOpenProject={onOpenProject}
            />
          ))}
        </div>
      )}
    </div>
  )
}
