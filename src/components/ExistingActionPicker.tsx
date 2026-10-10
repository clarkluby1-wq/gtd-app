import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db/db'
import { updateAction } from '../db/operations'
import { meaningfulWords } from '../lib/similar'
import type { Action, Project } from '../db/types'

const SUGGESTED = 3
const SEARCH_RESULTS = 8

/**
 * Pick an existing, unattached Next Action (or Waiting For) to become this project's next step — for when the step
 * was already captured but never linked. Only unassigned ones are offered, so nothing is pulled out of another
 * project by accident. The likeliest few (sharing a word with the project's name) come first; the rest are searchable.
 */
export function ExistingActionPicker({
  project,
  onLinked,
  onClose,
}: {
  project: Project
  onLinked: (title: string) => void
  onClose: () => void
}) {
  const orphans = useLiveQuery(() =>
    db.actions.filter((a) => (a.status === 'next' || a.status === 'waiting') && !a.projectId).toArray(),
  )
  const [query, setQuery] = useState('')

  if (orphans === undefined) return null

  const mine = meaningfulWords(project.title)
  const shared = (a: Action) => [...meaningfulWords(a.title)].filter((w) => mine.has(w)).length
  const related = orphans
    .map((a) => ({ a, n: shared(a) }))
    .filter((x) => x.n > 0)
    .sort((x, y) => y.n - x.n)
    .slice(0, SUGGESTED)
    .map((x) => x.a)

  const q = query.trim().toLowerCase()
  const found = q ? orphans.filter((a) => a.title.toLowerCase().includes(q)).slice(0, SEARCH_RESULTS) : []

  const link = async (a: Action) => {
    await updateAction(a.id, { projectId: project.id })
    onLinked(a.title)
  }

  const row = (a: Action) => (
    <button
      key={a.id}
      onClick={() => void link(a)}
      title={`Make this part of “${project.title}”`}
      className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm text-neutral-200 hover:bg-neutral-800"
    >
      <span className="min-w-0 truncate">{a.title}</span>
      {a.status === 'waiting' && <span className="shrink-0 text-xs text-neutral-500">waiting on {a.waitingOn ?? 'someone'}</span>}
    </button>
  )

  return (
    <div className="mt-2 rounded-md border border-neutral-800 bg-neutral-950 p-2">
      {related.length > 0 && (
        <>
          <div className="px-2 pb-1 text-xs text-neutral-500">Looks related — tap one to link it</div>
          {related.map(row)}
        </>
      )}
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={
          orphans.length > 0
            ? `Search all ${orphans.length} unassigned Next Action${orphans.length === 1 ? '' : 's'}…`
            : 'No unassigned Next Actions'
        }
        disabled={orphans.length === 0}
        className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm outline-none disabled:opacity-50"
      />
      {q && found.length === 0 && <p className="px-2 pt-2 text-xs text-neutral-500">Nothing unassigned matches that.</p>}
      {found.map(row)}
      <button onClick={onClose} className="mt-2 px-2 text-xs text-neutral-500 hover:text-neutral-300">
        Close
      </button>
    </div>
  )
}
