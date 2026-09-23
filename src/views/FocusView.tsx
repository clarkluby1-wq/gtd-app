import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState, type ReactNode } from 'react'
import { db } from '../db/db'
import { completeAction } from '../db/operations'
import { celebrateCompletion } from '../lib/celebrateCompletion'
import { useCompletionToast } from '../lib/completionToastContext'
import { formatShortDate, startOfWorkday } from '../lib/date'
import { describeFilters, matchesNextFilters, type NextFilters } from '../lib/nextFilters'
import { useSomedayProjectIds } from '../lib/useSomedayProjectIds'

/**
 * One task, nothing else. It offers your Short List first, then whatever is due soonest, then your own order,
 * staying within any filters you had on Next Actions. "Not this one" only skips it for this sitting — nothing is
 * hidden, moved or changed. Finishing a task uses the usual celebration and "what's next?" card, then the next one
 * appears on its own.
 */
export function FocusView({
  filters,
  onStop,
  onOpenNextActions,
}: {
  filters: NextFilters
  onStop: () => void
  onOpenNextActions: () => void
}) {
  const nexts = useLiveQuery(() => db.actions.where('status').equals('next').toArray())
  const contexts = useLiveQuery(() => db.contexts.toArray())
  const somedayProjectIds = useSomedayProjectIds()
  const { notify } = useCompletionToast()
  const today = startOfWorkday()

  const [skipped, setSkipped] = useState<Set<string>>(new Set())
  const [doneCount, setDoneCount] = useState(0)

  const queue = useMemo(
    () =>
      (nexts ?? [])
        .filter((a) => !a.projectId || !somedayProjectIds.has(a.projectId))
        .filter((a) => matchesNextFilters(a, filters))
        .sort(
          (a, b) =>
            Number(b.bigThreeDate === today) - Number(a.bigThreeDate === today) ||
            Number(b.dueDate != null) - Number(a.dueDate != null) ||
            (a.dueDate ?? 0) - (b.dueDate ?? 0) ||
            a.order - b.order,
        ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nexts, somedayProjectIds, filters, today],
  )
  const current = queue.find((a) => !skipped.has(a.id))

  const project = useLiveQuery(
    () => (current?.projectId ? db.projects.get(current.projectId) : undefined),
    [current?.projectId],
  )
  const contextName = (id?: string) => contexts?.find((c) => c.id === id)?.name
  const filterText = describeFilters(filters, contextName(filters.contextId))

  const shell = (children: ReactNode) => (
    <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center p-6 text-center">
      {children}
    </div>
  )

  if (nexts === undefined) return shell(null)

  // Nothing to offer at all.
  if (queue.length === 0) {
    return shell(
      <>
        <h1 className="mb-2 text-2xl font-semibold text-neutral-100">
          {doneCount > 0 ? 'All clear.' : 'Nothing to focus on right now.'}
        </h1>
        <p className="mb-6 text-sm text-neutral-500">
          {doneCount > 0
            ? 'That was everything on your list. Nicely done.'
            : filterText
              ? `Nothing matches ${filterText}.`
              : 'You have no Next Actions yet. Sorting your Inbox will fill this in.'}
        </p>
        <button
          onClick={onStop}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
        >
          Back
        </button>
      </>,
    )
  }

  // Everything on offer has been passed over this time.
  if (!current) {
    return shell(
      <>
        <h1 className="mb-2 text-2xl font-semibold text-neutral-100">That's everything for now.</h1>
        <p className="mb-6 text-sm text-neutral-500">Nothing was changed. Want to go around again, or stop here?</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            onClick={() => setSkipped(new Set())}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Go around again
          </button>
          <button
            onClick={onStop}
            className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
          >
            Stop
          </button>
        </div>
        <button onClick={onOpenNextActions} className="mt-6 text-xs text-neutral-500 hover:text-neutral-300">
          See all Next Actions →
        </button>
      </>,
    )
  }

  const detail = [
    project?.title,
    contextName(current.contextId),
    current.timeEstimateMin ? `${current.timeEstimateMin} min` : '',
    current.dueDate != null ? `due ${formatShortDate(current.dueDate)}` : '',
  ]
    .filter(Boolean)
    .join(' · ')

  return shell(
    <>
      <div className="mb-6 text-xs uppercase tracking-wide text-neutral-500">Focus</div>
      {current.bigThreeDate === today && <div className="mb-2 text-xs text-amber-400">★ On today's Short List</div>}
      <h1 className="mb-3 text-2xl font-semibold leading-snug text-neutral-100">{current.title}</h1>
      {detail && <p className="mb-8 text-sm text-neutral-500">{detail}</p>}
      {!detail && <div className="mb-8" />}

      <div className="flex flex-wrap justify-center gap-3">
        <button
          onClick={(e) => {
            completeAction(current.id)
            notify(current)
            void celebrateCompletion(current, e.currentTarget)
            setDoneCount((n) => n + 1)
          }}
          className="rounded-lg bg-emerald-600 px-6 py-3 text-base font-medium text-white hover:bg-emerald-500"
        >
          ✓ Done
        </button>
        <button
          onClick={() => setSkipped((prev) => new Set(prev).add(current.id))}
          title="Skip it for now. Nothing is changed."
          className="rounded-lg border border-neutral-700 px-6 py-3 text-base text-neutral-300 hover:bg-neutral-800"
        >
          Not this one
        </button>
      </div>

      <button onClick={onStop} className="mt-8 text-xs text-neutral-500 hover:text-neutral-300">
        Stop
      </button>
      {filterText && <p className="mt-4 text-xs text-neutral-600">Within: {filterText}</p>}
    </>,
  )
}
