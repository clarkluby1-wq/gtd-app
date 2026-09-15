import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { clarifyAsNextAction, updateProject } from '../db/operations'
import { TaskRow } from '../components/TaskRow'

export function SomedayMaybeView({ onOpenProject }: { onOpenProject: (id: string) => void }) {
  const actions = useLiveQuery(() => db.actions.where('status').equals('someday').sortBy('createdAt'))
  const somedayProjects = useLiveQuery(() => db.projects.where('status').equals('someday').sortBy('createdAt'))

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-1 text-xl font-semibold text-neutral-100">Someday / Maybe</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Not committed to right now, but not dead either. Revisit during your weekly review — activate when ready.
      </p>

      <div className="flex flex-col divide-y divide-neutral-900">
        {actions?.map((a) => (
          <div key={a.id} className="flex items-center justify-between py-2">
            <TaskRow action={a} />
            <button
              onClick={() => clarifyAsNextAction(a.id, {})}
              className="ml-2 shrink-0 rounded-md bg-neutral-800 px-2 py-1 text-xs text-neutral-300 hover:bg-emerald-600 hover:text-white"
            >
              Activate
            </button>
          </div>
        ))}
      </div>

      {!!somedayProjects?.length && (
        <>
          <h2 className="mb-2 mt-6 text-sm font-medium text-neutral-400">Someday Projects</h2>
          <div className="flex flex-col divide-y divide-neutral-900">
            {somedayProjects.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2">
                <button
                  onClick={() => onOpenProject(p.id)}
                  className="flex-1 text-left text-sm text-neutral-200 hover:underline"
                >
                  {p.title}
                </button>
                <button
                  onClick={() => updateProject(p.id, { status: 'active' })}
                  className="ml-2 shrink-0 rounded-md bg-neutral-800 px-2 py-1 text-xs text-neutral-300 hover:bg-emerald-600 hover:text-white"
                >
                  Activate
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {actions?.length === 0 && !somedayProjects?.length && (
        <div className="rounded-lg border border-dashed border-neutral-800 p-8 text-center text-sm text-neutral-500">
          Nothing parked here.
        </div>
      )}
    </div>
  )
}
