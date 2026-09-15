import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from '../db/db'
import { TaskRow } from '../components/TaskRow'
import { useSomedayProjectIds } from '../lib/useSomedayProjectIds'

export function WaitingForView() {
  const actions = useLiveQuery(() => db.actions.where('status').equals('waiting').sortBy('createdAt'))
  const somedayProjectIds = useSomedayProjectIds()

  const filtered = useMemo(
    () => actions?.filter((a) => !a.projectId || !somedayProjectIds.has(a.projectId)) ?? [],
    [actions, somedayProjectIds],
  )

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

      <div className="flex flex-col divide-y divide-neutral-900">
        {filtered.map((a) => (
          <TaskRow key={a.id} action={a} showProject />
        ))}
      </div>
    </div>
  )
}
