import { closestCenter, DndContext } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { db } from '../db/db'
import { updateAction } from '../db/operations'
import { SortableTaskRow } from '../components/SortableTaskRow'
import { useDragReorder } from '../lib/useDragReorder'
import { useSomedayProjectIds } from '../lib/useSomedayProjectIds'
import type { EnergyLevel } from '../db/types'

export function NextActionsView() {
  const actions = useLiveQuery(() => db.actions.where('status').equals('next').sortBy('order'))
  const contexts = useLiveQuery(() => db.contexts.orderBy('order').toArray())
  const somedayProjectIds = useSomedayProjectIds()

  const [contextId, setContextId] = useState<string>('all')
  const [energy, setEnergy] = useState<EnergyLevel | 'all'>('all')
  const [maxTime, setMaxTime] = useState<number | 'all'>('all')

  const filtered = useMemo(() => {
    if (!actions) return []
    return actions.filter((a) => {
      if (a.projectId && somedayProjectIds.has(a.projectId)) return false
      if (contextId !== 'all' && a.contextId !== contextId) return false
      if (energy !== 'all' && a.energy !== energy) return false
      if (maxTime !== 'all' && (a.timeEstimateMin == null || a.timeEstimateMin > maxTime)) return false
      return true
    })
  }, [actions, contextId, energy, maxTime, somedayProjectIds])

  const { sensors, handleDragEnd } = useDragReorder(filtered, (id, order) => {
    void updateAction(id, { order })
  })

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-1 text-xl font-semibold text-neutral-100">Next Actions</h1>
      <p className="mb-4 text-sm text-neutral-500">
        Engage: filter by what you can actually do right now — where you are, how much energy you have, how much
        time you've got. Drag the ⠿ handle to reorder.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={contextId}
          onChange={(e) => setContextId(e.target.value)}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-200"
        >
          <option value="all">Any context</option>
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

      {filtered.length === 0 && (
        <div className="rounded-lg border border-dashed border-neutral-800 p-8 text-center text-sm text-neutral-500">
          Nothing matches those filters.
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={filtered.map((a) => a.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col divide-y divide-neutral-900">
            {filtered.map((a) => (
              <SortableTaskRow key={a.id} action={a} showProject />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
