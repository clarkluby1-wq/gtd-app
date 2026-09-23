import { closestCenter, DndContext } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { db } from '../db/db'
import { updateAction } from '../db/operations'
import { SortableTaskRow } from '../components/SortableTaskRow'
import { matchesNextFilters, type NextFilters } from '../lib/nextFilters'
import { useDragReorder } from '../lib/useDragReorder'
import { startOfWorkday } from '../lib/date'
import { useSomedayProjectIds } from '../lib/useSomedayProjectIds'
import { useTodayPinCount } from '../lib/shortList'
import type { EnergyLevel } from '../db/types'

export function NextActionsView({
  onOpenProject,
  onFocus,
  onAskWhatNow,
}: {
  onOpenProject: (projectId: string) => void
  /** Start Focus mode, staying within whatever filters are set here. */
  onFocus: (filters: NextFilters) => void
  onAskWhatNow: () => void
}) {
  const actions = useLiveQuery(() => db.actions.where('status').equals('next').sortBy('order'))
  const contexts = useLiveQuery(() => db.contexts.orderBy('order').toArray())
  const somedayProjectIds = useSomedayProjectIds()
  const today = startOfWorkday()
  // Global: a pinned Waiting For or Scheduled item uses a slot too, same cap as here.
  const pinnedTodayCount = useTodayPinCount()

  const [contextId, setContextId] = useState<string>('all')
  const [energy, setEnergy] = useState<EnergyLevel | 'all'>('all')
  const [maxTime, setMaxTime] = useState<number | 'all'>('all')

  // Today's Short List items float to the top of whatever's left after filtering — Array.sort is
  // stable, so everything else keeps its existing (drag-reorderable) order underneath them.
  const filtered = useMemo(() => {
    if (!actions) return []
    return actions
      .filter((a) => !(a.projectId && somedayProjectIds.has(a.projectId)))
      .filter((a) => matchesNextFilters(a, { contextId, energy, maxTime }))
      .sort((a, b) => Number(b.bigThreeDate === today) - Number(a.bigThreeDate === today))
  }, [actions, contextId, energy, maxTime, somedayProjectIds, today])

  const { sensors, handleDragEnd } = useDragReorder(filtered, (id, order) => {
    void updateAction(id, { order })
  })

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-neutral-100">Next Actions</h1>
        <button
          onClick={() => onFocus({ contextId, energy, maxTime })}
          title="Show just one task at a time"
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
        >
          Focus on one ▶
        </button>
      </div>
      <p className="mb-4 text-sm text-neutral-500">
        Engage: filter by what you can actually do right now — where you are, how much energy you have, how much
        time you've got. Drag the ⠿ handle to reorder. Hover a row and click ☆ to add up to three to today's Short List
        — pinned items always float to the top, within any filter.{' '}
        <button onClick={onAskWhatNow} className="text-emerald-400 hover:text-emerald-300">
          Not sure what fits? Ask What Now? →
        </button>
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={contextId}
          onChange={(e) => setContextId(e.target.value)}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-200"
        >
          <option value="all">Any context</option>
          <option value="none">None</option>
          {contexts?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={energy}
          onChange={(e) => setEnergy(e.target.value as EnergyLevel | 'all')}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-200"
        >
          <option value="all">Any energy</option>
          <option value="low">Low energy</option>
          <option value="medium">Medium energy</option>
          <option value="high">High energy</option>
        </select>

        <select
          value={maxTime}
          onChange={(e) => setMaxTime(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-200"
        >
          <option value="all">Any amount of time</option>
          <option value="15">≤ 15 min</option>
          <option value="30">≤ 30 min</option>
          <option value="60">≤ 1 hour</option>
        </select>
      </div>
      {(energy !== 'all' || maxTime !== 'all') && (
        <p className="-mt-2 mb-4 text-xs text-neutral-600">
          Actions with no energy or time estimate still show — they might fit.
        </p>
      )}

      {filtered.length === 0 && (
        <div className="rounded-lg border border-dashed border-neutral-800 p-8 text-center text-sm text-neutral-500">
          Nothing matches those filters.
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
                showBigThreePin
                pinnedTodayCount={pinnedTodayCount}
                onOpenProject={onOpenProject}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
