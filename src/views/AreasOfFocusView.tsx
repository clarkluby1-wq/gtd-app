import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { v4 as uuid } from 'uuid'
import { db } from '../db/db'

export function AreasOfFocusView({ onOpenProject }: { onOpenProject: (id: string) => void }) {
  const areas = useLiveQuery(() => db.areasOfFocus.orderBy('order').toArray())
  const projects = useLiveQuery(() => db.projects.where('status').equals('active').toArray())
  const goals = useLiveQuery(() => db.goals.where('status').equals('active').toArray())
  const [name, setName] = useState('')

  const addArea = async () => {
    if (!name.trim()) return
    const count = await db.areasOfFocus.count()
    await db.areasOfFocus.add({ id: uuid(), name: name.trim(), order: count })
    setName('')
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-1 text-xl font-semibold text-neutral-100">Areas of Focus</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Horizon 2 (20,000 ft) — the ongoing roles and responsibilities you're maintaining standards for, not
        projects with an end date. Goals and Projects can anchor to one of these.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void addArea()
        }}
        className="mb-6 flex gap-2"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add an area of focus…"
          className="flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none"
        />
        <button type="submit" className="rounded-md bg-neutral-800 px-3 py-2 text-xs text-neutral-200 hover:bg-emerald-600 hover:text-white">
          Add
        </button>
      </form>

      <div className="flex flex-col gap-4">
        {areas?.map((area) => {
          const linkedProjects = projects?.filter((p) => p.areaOfFocusId === area.id) ?? []
          const linkedGoals = goals?.filter((g) => g.areaOfFocusId === area.id) ?? []
          return (
            <div key={area.id} className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
              <div className="font-medium text-neutral-100">{area.name}</div>
              {area.description && <p className="mt-1 text-sm text-neutral-500">{area.description}</p>}

              {linkedGoals.length > 0 && (
                <div className="mt-2 flex flex-col gap-1">
                  {linkedGoals.map((g) => (
                    <div key={g.id} className="text-sm text-amber-300">
                      🎯 {g.title}
                    </div>
                  ))}
                </div>
              )}

              {linkedProjects.length === 0 ? (
                <p className="mt-2 text-xs text-neutral-600">No active projects anchored here.</p>
              ) : (
                <div className="mt-2 flex flex-col gap-1">
                  {linkedProjects.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => onOpenProject(p.id)}
                      className="text-left text-sm text-neutral-300 hover:text-emerald-400"
                    >
                      · {p.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
