import { useState } from 'react'
import { SHORT_LIST_MAX_WORD } from '../lib/shortList'
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
  const [showDone, setShowDone] = useState(false)
  const open = actions.filter((a) => a.status !== 'done')
  const done = actions.filter((a) => a.status === 'done')

  const row = (a: Action) => (
    <TaskRow
      key={a.id}
      action={a}
      showProject
      showBigThreePin
      pinnedTodayCount={actions.length}
      onOpenProject={onOpenProject}
    />
  )

  return (
    <div className="mb-6 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <div className="mb-3 flex items-center gap-1.5">
        <h2 className="text-sm font-medium text-neutral-300">Today's Short List</h2>
        <span
          title={`Up to ${SHORT_LIST_MAX_WORD} things you're committed to today, picked from Next Actions. It's not a second to-do list, just a flag on items already in Next Actions. Whatever's left unfinished quietly stops being pinned when your next workday starts, no guilt.`}
          className="cursor-help text-xs text-neutral-500 hover:text-neutral-300"
        >
          ⓘ
        </span>
      </div>

      {actions.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Nothing pinned yet.{' '}
          <button onClick={onViewNextActions} className="text-emerald-400 hover:text-emerald-300">
            Pin up to {SHORT_LIST_MAX_WORD} from Next Actions →
          </button>
        </p>
      ) : (
        <>
          {open.length === 0 ? (
            <p className="text-sm text-emerald-400">All done — nice.</p>
          ) : (
            <div className="flex flex-col divide-y divide-neutral-900">{open.map(row)}</div>
          )}

          {/* Finished picks fold into one quiet line, so the list reads as "what's left" and the wins are a glance,
              not a re-read. Open it to see them (or to un-tick one by mistake). */}
          {done.length > 0 && (
            <div className={open.length === 0 ? 'mt-1' : 'mt-3'}>
              <button
                onClick={() => setShowDone((v) => !v)}
                aria-expanded={showDone}
                className="text-xs text-neutral-500 hover:text-neutral-300"
              >
                ✓ {done.length} finished today {showDone ? '▾' : '▸'}
              </button>
              {showDone && <div className="mt-1 flex flex-col divide-y divide-neutral-900">{done.map(row)}</div>}
            </div>
          )}
        </>
      )}
    </div>
  )
}
