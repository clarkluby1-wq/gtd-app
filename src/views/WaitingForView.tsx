import { closestCenter, DndContext } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from '../db/db'
import { logFollowUp, undoLastFollowUp, updateAction } from '../db/operations'
import type { Action } from '../db/types'
import { SortableTaskRow } from '../components/SortableTaskRow'
import { startOfToday } from '../lib/date'
import { useDragReorder } from '../lib/useDragReorder'
import { useSomedayProjectIds } from '../lib/useSomedayProjectIds'

export function WaitingForView({ onOpenProject }: { onOpenProject: (projectId: string) => void }) {
  const actions = useLiveQuery(() => db.actions.where('status').equals('waiting').sortBy('order'))
  const somedayProjectIds = useSomedayProjectIds()

  const filtered = useMemo(
    () => actions?.filter((a) => !a.projectId || !somedayProjectIds.has(a.projectId)) ?? [],
    [actions, somedayProjectIds],
  )

  const { sensors, handleDragEnd } = useDragReorder(filtered, (id, order) => {
    void updateAction(id, { order })
  })

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-1 text-xl font-semibold text-neutral-100">Waiting For</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Things delegated to someone else, or blocked on an external event. Review these regularly and follow up.
      </p>

      {filtered.length === 0 && (
        <div className="rounded-lg border border-dashed border-neutral-800 p-8 text-center text-sm text-neutral-500">
          Nothing pending on anyone else.
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={filtered.map((a) => a.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col divide-y divide-neutral-900">
            {filtered.map((a) => (
              <SortableTaskRow
                key={a.id}
                action={a}
                showProject
                showWaitingClock
                extraAction={<FollowUpControl action={a} />}
                onOpenProject={onOpenProject}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}

/** One click records that you followed up. It's a day-level fact, so once it's logged today it shows as done, with an undo for mistakes. */
function FollowUpControl({ action }: { action: Action }) {
  const last = action.followUps?.[action.followUps.length - 1]
  const followedUpToday = last !== undefined && last >= startOfToday()

  if (followedUpToday) {
    return (
      <span className="flex shrink-0 items-center gap-2 text-xs text-emerald-400">
        ✓ Followed up today
        <button onClick={() => undoLastFollowUp(action.id)} className="text-neutral-500 hover:text-neutral-300">
          undo
        </button>
      </span>
    )
  }
  return (
    <button
      onClick={() => logFollowUp(action.id)}
      title="Log that you followed up — a reminder, a nudge, a call"
      className="shrink-0 rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:bg-emerald-600 hover:text-white"
    >
      Followed up
    </button>
  )
}
