import { closestCenter, DndContext } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { db } from '../db/db'
import { updateAction } from '../db/operations'
import type { Action } from '../db/types'
import { FollowUpControl } from '../components/FollowUpControl'
import { SortableTaskRow } from '../components/SortableTaskRow'
import { TaskRow } from '../components/TaskRow'
import { useDragReorder } from '../lib/useDragReorder'
import { useSomedayProjectIds } from '../lib/useSomedayProjectIds'
import { lastFollowUpAt, needsNudge, NUDGE_AFTER_DAYS, wasFollowedUpToday, waitingStartedAt } from '../lib/waiting'

type SortMode = 'mine' | 'longest' | 'newest'
type GroupMode = 'none' | 'project'

const SORT_OPTIONS: { value: SortMode; label: string; hint: string }[] = [
  { value: 'mine', label: 'Sort: My order', hint: 'Drag the ⠿ handle to reorder.' },
  { value: 'longest', label: 'Sort: Waiting longest', hint: 'Handed off the longest ago comes first.' },
  { value: 'newest', label: 'Sort: Most recent', hint: 'Handed off most recently comes first.' },
]

const COMPARE: Record<Exclude<SortMode, 'mine'>, (a: Action, b: Action) => number> = {
  longest: (a, b) => waitingStartedAt(a) - waitingStartedAt(b),
  newest: (a, b) => waitingStartedAt(b) - waitingStartedAt(a),
}

// Sort and grouping are remembered so a weekly review doesn't start from scratch. The "needs a nudge"
// filter deliberately is not — a forgotten filter would quietly hide items.
const VIEW_KEY = 'gtd.waitingFor.view'

function readView(): { sort: SortMode; group: GroupMode } {
  try {
    const saved = JSON.parse(localStorage.getItem(VIEW_KEY) ?? '{}')
    return {
      sort: SORT_OPTIONS.some((o) => o.value === saved.sort) ? saved.sort : 'mine',
      group: saved.group === 'project' ? 'project' : 'none',
    }
  } catch {
    return { sort: 'mine', group: 'none' }
  }
}

function saveView(view: { sort: SortMode; group: GroupMode }) {
  try {
    localStorage.setItem(VIEW_KEY, JSON.stringify(view))
  } catch {
    // Not remembering is fine; it just starts on "My order" next time.
  }
}

/**
 * Followed up today = parked at the bottom until tomorrow. This is only how the list is displayed —
 * the saved order is untouched, so an item snaps back to its own place tomorrow (or the instant you undo).
 * Parked items are ordered by when you followed up, so the newest lands at the very bottom.
 */
function splitParked(items: Action[]) {
  return {
    active: items.filter((a) => !wasFollowedUpToday(a)),
    parked: items
      .filter(wasFollowedUpToday)
      .sort((a, b) => (lastFollowUpAt(a) as number) - (lastFollowUpAt(b) as number)),
  }
}

export function WaitingForView({ onOpenProject }: { onOpenProject: (projectId: string) => void }) {
  const actions = useLiveQuery(() => db.actions.where('status').equals('waiting').sortBy('order'))
  const projects = useLiveQuery(() => db.projects.toArray())
  const somedayProjectIds = useSomedayProjectIds()

  const [view, setView] = useState(readView)
  const [nudgeOnly, setNudgeOnly] = useState(false)
  // Rows you just followed up on stay visible under the filter, so the undo is still reachable.
  const [justFollowedUp, setJustFollowedUp] = useState<Set<string>>(new Set())

  const changeView = (changes: Partial<typeof view>) => {
    const next = { ...view, ...changes }
    setView(next)
    saveView(next)
  }

  const all = useMemo(
    () => actions?.filter((a) => !a.projectId || !somedayProjectIds.has(a.projectId)) ?? [],
    [actions, somedayProjectIds],
  )
  const nudgeCount = all.filter(needsNudge).length

  const visible = useMemo(() => {
    // A row followed up this visit stays (with its undo) — but only while it still counts as followed up today,
    // so undoing it lets it leave the filter again if it doesn't actually need a nudge.
    const list = nudgeOnly
      ? all.filter((a) => needsNudge(a) || (justFollowedUp.has(a.id) && wasFollowedUpToday(a)))
      : all
    return view.sort === 'mine' ? list : [...list].sort(COMPARE[view.sort])
  }, [all, nudgeOnly, justFollowedUp, view.sort])

  const projectTitles = useMemo(() => new Map((projects ?? []).map((p) => [p.id, p.title])), [projects])

  const groups = useMemo(() => {
    if (view.group === 'none') {
      return [{ key: 'all', title: undefined, projectId: undefined, ...splitParked(visible) }]
    }
    const byProject = new Map<string, Action[]>()
    for (const a of visible) {
      const key = a.projectId && projectTitles.has(a.projectId) ? a.projectId : 'none'
      byProject.set(key, [...(byProject.get(key) ?? []), a])
    }
    return [...byProject.entries()]
      .map(([key, items]) => ({
        key,
        title: key === 'none' ? 'No project' : (projectTitles.get(key) as string),
        projectId: key === 'none' ? undefined : key,
        ...splitParked(items),
      }))
      .sort((a, b) => (a.key === 'none' ? 1 : b.key === 'none' ? -1 : a.title.localeCompare(b.title)))
  }, [view.group, visible, projectTitles])

  // Dragging only makes sense in your own order, with nothing grouped — otherwise the two orders would fight.
  // It only ever reorders the items not yet followed up today, so a parked row can't distort your saved order.
  const draggable = view.sort === 'mine' && view.group === 'none'
  const activeForDrag = draggable ? (groups[0]?.active ?? []) : []
  const { sensors, handleDragEnd } = useDragReorder(activeForDrag, (id, order) => {
    void updateAction(id, { order })
  })

  const followUp = (a: Action) => (
    <FollowUpControl action={a} onLogged={() => setJustFollowedUp((prev) => new Set(prev).add(a.id))} />
  )

  const plainRows = (items: Action[]) =>
    items.map((a) => (
      <TaskRow
        key={a.id}
        action={a}
        showProject={view.group !== 'project'}
        showWaitingClock
        extraAction={followUp(a)}
        onOpenProject={onOpenProject}
      />
    ))

  const parkedRows = (parked: Action[]) =>
    parked.length > 0 && (
      <div>
        <div
          className="px-3 pb-1 pt-4 text-xs text-neutral-500"
          title="Moved down for today. Back in its place tomorrow — or right away if you undo."
        >
          Followed up today · {parked.length}
        </div>
        <div className="flex flex-col divide-y divide-neutral-900">{plainRows(parked)}</div>
      </div>
    )

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-1 text-xl font-semibold text-neutral-100">Waiting For</h1>
      <p className="mb-4 text-sm text-neutral-500">
        Things delegated to someone else, or blocked on an external event. Review these regularly and follow up.
      </p>

      {all.length > 0 && (
        <>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <select
              value={view.sort}
              onChange={(e) => changeView({ sort: e.target.value as SortMode })}
              className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-200"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              value={view.group}
              onChange={(e) => changeView({ group: e.target.value as GroupMode })}
              className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-200"
            >
              <option value="none">Group: None</option>
              <option value="project">Group: By project</option>
            </select>
            <button
              onClick={() => setNudgeOnly((v) => !v)}
              aria-pressed={nudgeOnly}
              title={`Only items due a check-back: no contact for more than ${NUDGE_AFTER_DAYS} days, or the date you chose has come`}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                nudgeOnly
                  ? 'border-amber-500/50 bg-amber-500/20 text-amber-300'
                  : 'border-neutral-700 text-neutral-300 hover:bg-neutral-800'
              }`}
            >
              Needs a nudge{nudgeCount > 0 ? ` · ${nudgeCount}` : ''}
            </button>
          </div>
          <p className="mb-4 text-xs text-neutral-600">
            {SORT_OPTIONS.find((o) => o.value === view.sort)?.hint}
            {!draggable && view.sort === 'mine' ? ' Drag to reorder is off while grouped.' : ''}
          </p>
        </>
      )}

      {nudgeOnly && all.length > 0 && visible.length > 0 && all.length > visible.length && (
        <p className="mb-3 text-xs text-neutral-500">
          Showing {visible.length} of {all.length} · {all.length - visible.length} not due for a check-back{' '}
          {all.length - visible.length === 1 ? 'is' : 'are'} hidden.
        </p>
      )}

      {all.length === 0 && (
        <div className="rounded-lg border border-dashed border-neutral-800 p-8 text-center text-sm text-neutral-500">
          Nothing pending on anyone else.
        </div>
      )}

      {all.length > 0 && visible.length === 0 && (
        <div className="rounded-lg border border-dashed border-neutral-800 p-8 text-center text-sm text-neutral-500">
          Nobody needs a nudge right now.
        </div>
      )}

      {draggable ? (
        <>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={activeForDrag.map((a) => a.id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col divide-y divide-neutral-900">
                {activeForDrag.map((a) => (
                  <SortableTaskRow
                    key={a.id}
                    action={a}
                    showProject
                    showWaitingClock
                    extraAction={followUp(a)}
                    onOpenProject={onOpenProject}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          {parkedRows(groups[0]?.parked ?? [])}
        </>
      ) : (
        groups.map((g) => (
          <section key={g.key} className="mb-2">
            {g.title !== undefined && (
              <h2 className="mb-1 mt-4 flex items-center gap-2 px-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
                {g.projectId ? (
                  <button
                    onClick={() => onOpenProject(g.projectId as string)}
                    title="Open this project"
                    className="uppercase hover:text-emerald-400"
                  >
                    📁 {g.title}
                  </button>
                ) : (
                  g.title
                )}
                <span className="text-neutral-600">{g.active.length + g.parked.length}</span>
              </h2>
            )}
            <div className="flex flex-col divide-y divide-neutral-900">{plainRows(g.active)}</div>
            {parkedRows(g.parked)}
          </section>
        ))
      )}
    </div>
  )
}
