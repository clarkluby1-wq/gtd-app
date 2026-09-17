import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { db } from '../db/db'
import { TaskRow } from '../components/TaskRow'
import { updateProject } from '../db/operations'
import { startOfDay, startOfToday } from '../lib/date'
import type { Action, Project } from '../db/types'

type Entry = { completedAt: number } & ({ kind: 'action'; action: Action } | { kind: 'project'; project: Project })

function formatDayHeading(day: number) {
  const today = startOfToday()
  const oneDay = 24 * 60 * 60 * 1000
  if (day === today - oneDay) return 'Yesterday'
  return new Date(day).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

export function RecentlyCompletedView({ onOpenProject }: { onOpenProject: (id: string) => void }) {
  const doneActions = useLiveQuery(() => db.actions.where('status').equals('done').toArray())
  const doneProjects = useLiveQuery(() => db.projects.where('status').equals('completed').toArray())
  const [showOlder, setShowOlder] = useState(false)

  const entries = useMemo(() => {
    const actionEntries: Entry[] = (doneActions ?? [])
      .filter((a) => a.completedAt != null)
      .map((a) => ({ kind: 'action', action: a, completedAt: a.completedAt! }))
    const projectEntries: Entry[] = (doneProjects ?? [])
      .filter((p) => p.completedAt != null)
      .map((p) => ({ kind: 'project', project: p, completedAt: p.completedAt! }))
    return [...actionEntries, ...projectEntries].sort((a, b) => b.completedAt - a.completedAt)
  }, [doneActions, doneProjects])

  const today = startOfToday()
  const todayEntries = entries.filter((e) => e.completedAt >= today)
  const olderEntries = entries.filter((e) => e.completedAt < today)

  const olderByDay = useMemo(() => {
    const map = new Map<number, Entry[]>()
    for (const e of olderEntries) {
      const day = startOfDay(e.completedAt)
      if (!map.has(day)) map.set(day, [])
      map.get(day)!.push(e)
    }
    return [...map.entries()].sort((a, b) => b[0] - a[0])
  }, [olderEntries])

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-1 text-xl font-semibold text-neutral-100">Recently Completed</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Everything you've finished, kept so you can look back — and undo it if it was marked done by mistake.
      </p>

      <div className="mb-6">
        <h2 className="mb-2 text-xs font-medium text-neutral-500">
          Today {todayEntries.length > 0 && `(${todayEntries.length})`}
        </h2>
        {todayEntries.length === 0 ? (
          <p className="text-sm text-neutral-500">Nothing completed yet today.</p>
        ) : (
          <div className="flex flex-col divide-y divide-neutral-900 rounded-lg border border-neutral-900">
            {todayEntries.map((e) => (
              <EntryRow key={entryKey(e)} entry={e} onOpenProject={onOpenProject} />
            ))}
          </div>
        )}
      </div>

      {olderEntries.length > 0 && (
        <div>
          <button
            onClick={() => setShowOlder((v) => !v)}
            className="mb-2 flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-300"
          >
            <span className="text-[10px]">{showOlder ? '▾' : '▸'}</span>
            Older ({olderEntries.length})
          </button>
          {showOlder && (
            <div className="flex flex-col gap-4">
              {olderByDay.map(([day, dayEntries]) => (
                <div key={day}>
                  <h3 className="mb-1 text-xs font-medium text-neutral-600">{formatDayHeading(day)}</h3>
                  <div className="flex flex-col divide-y divide-neutral-900 rounded-lg border border-neutral-900">
                    {dayEntries.map((e) => (
                      <EntryRow key={entryKey(e)} entry={e} onOpenProject={onOpenProject} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function entryKey(e: Entry) {
  return e.kind === 'action' ? `a-${e.action.id}` : `p-${e.project.id}`
}

function EntryRow({ entry, onOpenProject }: { entry: Entry; onOpenProject: (id: string) => void }) {
  if (entry.kind === 'action') {
    return <TaskRow action={entry.action} showProject />
  }
  return <CompletedProjectRow project={entry.project} onOpen={() => onOpenProject(entry.project.id)} />
}

function CompletedProjectRow({ project, onOpen }: { project: Project; onOpen: () => void }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 hover:bg-neutral-900">
      <span className="shrink-0 text-base" aria-hidden>
        🏁
      </span>
      <button onClick={onOpen} className="min-w-0 flex-1 truncate text-left text-sm text-neutral-100 hover:underline">
        Completed project: {project.title}
      </button>
      <button
        onClick={() => void updateProject(project.id, { status: 'active', completedAt: undefined })}
        className="shrink-0 text-xs text-neutral-500 hover:text-neutral-300"
      >
        Reopen
      </button>
    </div>
  )
}
