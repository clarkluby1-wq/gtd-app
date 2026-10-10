import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db/db'
import { updateProject } from '../db/operations'
import { useEscapeKey } from '../lib/useEscapeKey'
import type { Project } from '../db/types'

const field = 'rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none'

/** Change a project without leaving the screen you're on: its name, what "done" looks like, where it sits in your Horizons, and its notes. */
export function EditProjectModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const areas = useLiveQuery(() => db.areasOfFocus.orderBy('order').toArray())
  const goals = useLiveQuery(() => db.goals.where('status').equals('active').toArray())
  const [title, setTitle] = useState(project.title)
  const [outcome, setOutcome] = useState(project.outcome)
  const [notes, setNotes] = useState(project.notes ?? '')
  const [areaId, setAreaId] = useState(project.areaOfFocusId ?? '')
  const [goalId, setGoalId] = useState(project.goalId ?? '')
  useEscapeKey(onClose)

  const save = async () => {
    await updateProject(project.id, {
      title: title.trim() || project.title,
      outcome: outcome.trim(),
      notes: notes.trim() || undefined,
      areaOfFocusId: areaId || undefined,
      goalId: goalId || undefined,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-neutral-800 bg-neutral-900 text-neutral-100 shadow-xl">
        <div className="border-b border-neutral-800 px-5 py-3 text-xs uppercase tracking-wide text-neutral-500">
          Edit project
        </div>

        <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-5">
          <label className="text-xs text-neutral-500">Project name</label>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className={`${field} font-medium`} />

          <label className="mt-2 text-xs text-neutral-500">What does "done" look like?</label>
          <textarea
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            rows={3}
            placeholder="The successful outcome, in a sentence"
            className={field}
          />

          <label className="mt-2 text-xs text-neutral-500">Area of Focus</label>
          <select
            value={areaId}
            onChange={(e) => {
              setAreaId(e.target.value)
              setGoalId('')
            }}
            className={field}
          >
            <option value="">None</option>
            {areas?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>

          {areaId && (
            <>
              <label className="mt-2 text-xs text-neutral-500">Which Goal does this serve?</label>
              <select value={goalId} onChange={(e) => setGoalId(e.target.value)} className={field}>
                <option value="">None</option>
                {goals
                  ?.filter((g) => g.areaOfFocusId === areaId)
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title}
                    </option>
                  ))}
              </select>
            </>
          )}

          <label className="mt-2 text-xs text-neutral-500">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Optional — details, reminders, correspondence"
            className={field}
          />
        </div>

        <div className="flex justify-between border-t border-neutral-800 px-5 py-3">
          <button onClick={onClose} className="text-xs text-neutral-500 hover:text-neutral-300">
            Cancel
          </button>
          <button
            onClick={() => void save()}
            className="rounded-md bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
