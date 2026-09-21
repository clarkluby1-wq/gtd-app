import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { db } from '../db/db'
import { TaskRow } from '../components/TaskRow'
import { reopenAction } from '../db/operations'
import { startOfToday } from '../lib/date'
import { useSomedayProjectIds } from '../lib/useSomedayProjectIds'
import type { Action } from '../db/types'

const OTHERS_PREVIEW = 8

function timeOf(ts?: number) {
  return ts ? new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : ''
}

/**
 * "What have I gotten done today?" — today's Short List first (what you meant to do, and how much of it is done),
 * then everything else you finished. Meant to feel good to open, at any point in the day: an empty morning is
 * "the day isn't over", never a score against you.
 */
export function TodayView({
  onOpenProject,
  onViewNextActions,
}: {
  onOpenProject: (projectId: string) => void
  onViewNextActions: () => void
}) {
  const today = startOfToday()
  const [showAllOthers, setShowAllOthers] = useState(false)
  const somedayProjectIds = useSomedayProjectIds()

  const doneToday = useLiveQuery(
    () =>
      db.actions
        .where('status')
        .equals('done')
        .filter((a) => (a.completedAt ?? 0) >= today)
        .toArray(),
    [today],
  )
  const shortLeft = useLiveQuery(
    () =>
      db.actions
        .where('status')
        .equals('next')
        .filter((a) => a.bigThreeDate === today)
        .toArray(),
    [today],
  )
  const projectsDone = useLiveQuery(
    () =>
      db.projects
        .where('status')
        .equals('completed')
        .filter((p) => (p.completedAt ?? 0) >= today)
        .toArray(),
    [today],
  )
  const captured = useLiveQuery(() => db.captureEvents.where('createdAt').aboveOrEqual(today).count(), [today])
  const sorted = useLiveQuery(() => db.actions.filter((a) => (a.clarifiedAt ?? 0) >= today).count(), [today])

  const groups = useMemo(() => {
    const done = doneToday ?? []
    // A finished action keeps the day it was on the Short List, so this is exactly "what you called important today".
    const won = done.filter((a) => a.bigThreeDate === today).sort((a, b) => a.completedAt! - b.completedAt!)
    const others = done.filter((a) => a.bigThreeDate !== today).sort((a, b) => b.completedAt! - a.completedAt!)
    // Something in a project you've parked on Someday/Maybe isn't a to-do right now, even if it was starred earlier.
    const left = (shortLeft ?? []).filter((a) => !a.projectId || !somedayProjectIds.has(a.projectId)).sort((a, b) => a.order - b.order)
    return { won, others, left }
  }, [doneToday, shortLeft, today, somedayProjectIds])

  if (doneToday === undefined || shortLeft === undefined || projectsDone === undefined) return null

  const { won, others, left } = groups
  const shortTotal = won.length + left.length
  const totalDone = doneToday.length + projectsDone.length
  const allWon = shortTotal > 0 && left.length === 0
  const heading = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
  const shownOthers = showAllOthers ? others : others.slice(0, OTHERS_PREVIEW)

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-1 text-xl font-semibold text-neutral-100">Today So Far</h1>
      <p className="mb-6 text-sm text-neutral-500">{heading}. What you've moved forward today.</p>

      <div className="mb-6 flex items-baseline gap-3 rounded-lg border border-neutral-800 bg-neutral-900 px-5 py-4">
        {totalDone > 0 ? (
          <>
            <span className="text-4xl font-semibold text-emerald-400">{totalDone}</span>
            <span className="text-sm text-neutral-300">{totalDone === 1 ? 'thing finished today' : 'things finished today'}</span>
          </>
        ) : (
          <p className="text-sm text-neutral-400">
            Nothing checked off yet — the day isn't over. Even one small thing counts.
          </p>
        )}
      </div>

      <section
        className={`mb-6 rounded-lg border p-4 ${
          allWon ? 'border-amber-500/50 bg-amber-500/10' : 'border-neutral-800 bg-neutral-900'
        }`}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-neutral-300">Today's Short List</h2>
          {shortTotal > 0 && (
            <span className="flex items-center gap-2 text-xs text-neutral-400">
              <span className="text-base tracking-wide text-amber-400" aria-hidden>
                {'★'.repeat(won.length)}
                <span className="text-neutral-600">{'☆'.repeat(left.length)}</span>
              </span>
              {won.length} of {shortTotal} done
            </span>
          )}
        </div>

        {shortTotal === 0 ? (
          <p className="text-sm text-neutral-500">
            Nothing on today's Short List.{' '}
            <button onClick={onViewNextActions} className="text-emerald-400 hover:text-emerald-300">
              Pick up to three from Next Actions →
            </button>
          </p>
        ) : (
          <>
            {allWon && (
              <p className="mb-3 text-sm font-medium text-amber-300">
                ✓ Short List complete — the things that mattered most today are done.
              </p>
            )}

            {won.length > 0 && (
              <div className="flex flex-col gap-2">
                {won.map((a) => (
                  <WonRow key={a.id} action={a} />
                ))}
              </div>
            )}

            {left.length > 0 && (
              <div className={won.length > 0 ? 'mt-4' : ''}>
                <div className="mb-1 text-xs font-medium text-neutral-500">Still on your list</div>
                <div className="flex flex-col divide-y divide-neutral-900">
                  {left.map((a) => (
                    <TaskRow key={a.id} action={a} showProject onOpenProject={onOpenProject} />
                  ))}
                </div>
                <p className="mt-2 px-3 text-xs text-neutral-600">
                  Whatever's left is safe in Next Actions — it just stops being pinned at midnight.
                </p>
              </div>
            )}
          </>
        )}
      </section>

      {(others.length > 0 || projectsDone.length > 0) && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-medium text-neutral-300">
            {shortTotal > 0 ? 'Also finished today' : 'Finished today'}
          </h2>
          <div className="flex flex-col divide-y divide-neutral-900 rounded-lg border border-neutral-900">
            {projectsDone.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-3 py-2 text-sm text-neutral-100">
                <span aria-hidden>🏁</span>
                <span className="min-w-0 flex-1 break-words">Project finished: {p.title}</span>
                <span className="shrink-0 text-xs text-neutral-500">{timeOf(p.completedAt)}</span>
              </div>
            ))}
            {shownOthers.map((a) => (
              <div key={a.id} className="flex items-center">
                <div className="min-w-0 flex-1">
                  <TaskRow action={a} showProject onOpenProject={onOpenProject} />
                </div>
                <span className="shrink-0 pr-3 text-xs text-neutral-500">{timeOf(a.completedAt)}</span>
              </div>
            ))}
          </div>
          {others.length > OTHERS_PREVIEW && (
            <button
              onClick={() => setShowAllOthers((v) => !v)}
              className="mt-2 text-xs text-neutral-500 hover:text-neutral-300"
            >
              {showAllOthers ? 'Show fewer' : `Show all ${others.length}`}
            </button>
          )}
        </section>
      )}

      {((captured ?? 0) > 0 || (sorted ?? 0) > 0) && (
        <p className="text-xs text-neutral-500">
          {[
            (sorted ?? 0) > 0 && `You sorted ${sorted} ${sorted === 1 ? 'thing' : 'things'} into a clear next step`,
            (captured ?? 0) > 0 && `captured ${captured} so they weren't rattling around in your head`,
          ]
            .filter(Boolean)
            .join(' and ')}
          .
        </p>
      )}
    </div>
  )
}

/** A Short List item that got done: bright, starred, and unmissable — this is the feeling the list is for. */
function WonRow({ action }: { action: Action }) {
  const project = useLiveQuery(() => (action.projectId ? db.projects.get(action.projectId) : undefined), [action.projectId])
  return (
    <div className="flex items-center gap-3 rounded-lg border border-amber-500/40 bg-gradient-to-r from-amber-500/20 to-amber-500/5 px-4 py-3">
      <span className="text-2xl leading-none text-amber-300" aria-hidden>
        ★
      </span>
      <div className="min-w-0 flex-1">
        <div className="break-words text-sm font-semibold text-amber-50">{action.title}</div>
        <div className="mt-0.5 text-xs text-amber-200/70">
          Done{action.completedAt ? ` at ${timeOf(action.completedAt)}` : ''}
          {project ? ` · ${project.title}` : ''}
        </div>
      </div>
      <button
        onClick={() => void reopenAction(action.id)}
        title="Mark it not done"
        className="shrink-0 text-xs text-amber-200/60 hover:text-amber-100"
      >
        Undo
      </button>
    </div>
  )
}
