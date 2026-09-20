import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { db } from '../db/db'
import { TaskRow } from '../components/TaskRow'
import { useSomedayProjectIds } from '../lib/useSomedayProjectIds'
import { ageInDays, ageLabel, staleNextActions } from '../lib/staleness'
import { lastContactAt } from '../lib/waiting'
import { isProjectStalled, stalledMessage } from '../lib/projectHealth'
import { formatShortDate, startOfToday } from '../lib/date'
import type { Action, AreaOfFocus, Project } from '../db/types'

const ACCENT = '#10b981' // emerald-500 — this app's existing brand accent
const GRID = '#2c2c2a'
const STATUS = { good: '#0ca30c', warning: '#fab219', critical: '#d03b3b' }
const STALE_TIER_COLOR = { 7: '#fab219', 14: '#f2994a', 30: '#d03b3b' }

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function ageColor(days: number) {
  if (days < 3) return STATUS.good
  if (days <= 7) return STATUS.warning
  return STATUS.critical
}

const CAPTURE_FILL_CAP = 10

function captureTier(count: number): { icon: string; message: string } {
  if (count === 0) return { icon: '📥', message: 'Nothing captured yet today' }
  if (count <= 2) return { icon: '📥', message: 'Off to a good start' }
  if (count <= 5) return { icon: '✨', message: 'Nice capture streak' }
  if (count <= 9) return { icon: '🔥', message: "You're on fire" }
  return { icon: '🏆', message: 'Capture champion' }
}

export function DashboardView({
  onOpenProject,
  onViewWaitingFor,
  onViewNextActions,
}: {
  onOpenProject: (id: string) => void
  onViewWaitingFor: () => void
  onViewNextActions: () => void
}) {
  const areas = useLiveQuery(() => db.areasOfFocus.orderBy('order').toArray())
  const activeProjects = useLiveQuery(() => db.projects.where('status').equals('active').toArray())
  const completedProjects = useLiveQuery(() =>
    db.projects
      .where('status')
      .equals('completed')
      .toArray()
      .then((ps) => ps.sort((a, b) => (b.completedAt ?? b.createdAt) - (a.completedAt ?? a.createdAt))),
  )
  const allActions = useLiveQuery(() => db.actions.toArray())
  const waitingActionsRaw = useLiveQuery(() => db.actions.where('status').equals('waiting').toArray())
  const somedayProjectIds = useSomedayProjectIds()
  const capturedToday = useLiveQuery(
    () => db.captureEvents.where('createdAt').aboveOrEqual(startOfToday()).count(),
    [],
  )
  const todayStart = startOfToday()
  const actionsCompletedToday = (allActions ?? []).filter(
    (a) => a.status === 'done' && (a.completedAt ?? 0) >= todayStart,
  ).length
  const projectsCompletedToday = (completedProjects ?? []).filter(
    (p) => (p.completedAt ?? 0) >= todayStart,
  ).length

  const waitingActions = useMemo(() => {
    return (waitingActionsRaw ?? [])
      .filter((a) => !a.projectId || !somedayProjectIds.has(a.projectId))
      .sort((a, b) => lastContactAt(a) - lastContactAt(b))
  }, [waitingActionsRaw, somedayProjectIds])

  const staleActions = useMemo(
    () => staleNextActions(allActions ?? [], somedayProjectIds),
    [allActions, somedayProjectIds],
  )

  const bigThreeActions = useMemo(() => {
    const today = startOfToday()
    return (allActions ?? []).filter((a) => a.bigThreeDate === today)
  }, [allActions])

  const stalledProjectIds = useMemo(() => {
    return new Set(
      (activeProjects ?? []).filter((p) => isProjectStalled(p, allActions ?? [])).map((p) => p.id),
    )
  }, [activeProjects, allActions])

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-1 text-xl font-semibold text-neutral-100">Dashboard</h1>
      <p className="mb-6 text-sm text-neutral-500">A glance at the whole system, not just one list.</p>

      <BigThree actions={bigThreeActions} onViewNextActions={onViewNextActions} onOpenProject={onOpenProject} />

      <CaptureReward
        count={capturedToday ?? 0}
        actionsCompleted={actionsCompletedToday}
        projectsCompleted={projectsCompletedToday}
      />

      <BalanceWheel areas={areas ?? []} projects={activeProjects ?? []} />

      <ProjectOverview
        activeProjects={activeProjects ?? []}
        completedProjects={completedProjects ?? []}
        actions={allActions ?? []}
        stalledProjectIds={stalledProjectIds}
        onOpen={onOpenProject}
      />

      <StaleNextActions stale={staleActions} onViewAll={onViewNextActions} />

      <WaitingForAging actions={waitingActions} onViewAll={onViewWaitingFor} />
    </div>
  )
}

function BigThree({
  actions,
  onViewNextActions,
  onOpenProject,
}: {
  actions: Action[]
  onViewNextActions: () => void
  onOpenProject: (id: string) => void
}) {
  return (
    <div className="mb-6 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <div className="mb-3 flex items-center gap-1.5">
        <h2 className="text-sm font-medium text-neutral-300">Today's Big Three</h2>
        <span
          title="Up to three things you're committed to today, pinned from Next Actions. Not a new list — just a focus flag. Whatever's left unfinished quietly stops being pinned at midnight, no guilt."
          className="cursor-help text-xs text-neutral-500 hover:text-neutral-300"
        >
          ⓘ
        </span>
      </div>

      {actions.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Nothing pinned yet.{' '}
          <button onClick={onViewNextActions} className="text-emerald-400 hover:text-emerald-300">
            Pin up to three from Next Actions →
          </button>
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-neutral-900">
          {actions.map((a) => (
            <TaskRow
              key={a.id}
              action={a}
              showProject
              showBigThreePin
              pinnedTodayCount={actions.length}
              onOpenProject={onOpenProject}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CaptureReward({
  count,
  actionsCompleted,
  projectsCompleted,
}: {
  count: number
  actionsCompleted: number
  projectsCompleted: number
}) {
  const { icon, message } = captureTier(count)
  const fillPct = Math.min(count, CAPTURE_FILL_CAP) / CAPTURE_FILL_CAP

  return (
    <div className="mb-6 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <div className="flex items-center gap-4">
        <div className="text-3xl" aria-hidden>
          {icon}
        </div>
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-neutral-100">{count}</span>
            <span className="text-sm text-neutral-500">captured today</span>
          </div>
          <div className="mt-0.5 text-xs text-neutral-500">{message}</div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${fillPct * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-neutral-800 pt-3">
        <TodayStat label="Captures" count={count} />
        <TodayStat label="Actions Done" count={actionsCompleted} />
        <TodayStat label="Projects Completed" count={projectsCompleted} />
      </div>
    </div>
  )
}

function TodayStat({ label, count }: { label: string; count: number }) {
  return (
    <div className="text-center">
      <div className="text-lg font-semibold text-neutral-100">{count}</div>
      <div className="text-[11px] text-neutral-500">{label}</div>
    </div>
  )
}

function BalanceWheel({ areas, projects }: { areas: AreaOfFocus[]; projects: Project[] }) {
  const spokes = useMemo(() => {
    const named = areas.map((a) => ({
      key: a.id,
      label: a.name,
      count: projects.filter((p) => p.areaOfFocusId === a.id).length,
      color: ACCENT,
    }))
    const unassignedCount = projects.filter((p) => !p.areaOfFocusId).length
    return unassignedCount > 0
      ? [...named, { key: 'unassigned', label: 'Unassigned', count: unassignedCount, color: STATUS.warning }]
      : named
  }, [areas, projects])

  if (spokes.length === 0) {
    return (
      <div className="mb-6 rounded-lg border border-dashed border-neutral-800 p-8 text-center text-sm text-neutral-500">
        Add an Area of Focus to see your balance wheel.
      </div>
    )
  }

  // Wide margin either side of the circle for labels — truncated rather than
  // clipped, since an Area name can be arbitrarily long (user-added areas).
  const width = 420
  const height = 300
  const cx = width / 2
  const cy = height / 2
  const maxRadius = 80
  const maxCount = Math.max(1, ...spokes.map((s) => s.count))
  const angleStep = 360 / spokes.length
  const MAX_LABEL_CHARS = 15
  const truncate = (label: string) =>
    label.length > MAX_LABEL_CHARS ? `${label.slice(0, MAX_LABEL_CHARS - 1)}…` : label

  return (
    <div className="mb-6 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <div className="mb-2 flex items-center gap-1.5">
        <h2 className="text-sm font-medium text-neutral-300">Balance Wheel</h2>
        <span
          title="Active projects per Area of Focus. A lopsided wheel means one area is quietly eating all your attention."
          className="cursor-help text-xs text-neutral-500 hover:text-neutral-300"
        >
          ⓘ
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="mx-auto w-full max-w-[420px]">
        {[0.33, 0.66, 1].map((f) => (
          <circle key={f} cx={cx} cy={cy} r={maxRadius * f} fill="none" stroke={GRID} strokeWidth={1} />
        ))}
        {spokes.map((s, i) => {
          const angle = i * angleStep
          const len = (s.count / maxCount) * maxRadius
          const tip = polar(cx, cy, Math.max(len, 2), angle)
          const labelPos = polar(cx, cy, maxRadius + 20, angle)
          const cos = Math.cos(((angle - 90) * Math.PI) / 180)
          const anchor = cos > 0.3 ? 'start' : cos < -0.3 ? 'end' : 'middle'
          return (
            <g key={s.key}>
              <title>
                {s.label}: {s.count} active project{s.count === 1 ? '' : 's'}
              </title>
              <line x1={cx} y1={cy} x2={tip.x} y2={tip.y} stroke={s.color} strokeWidth={14} strokeLinecap="round" />
              <text
                x={labelPos.x}
                y={labelPos.y}
                textAnchor={anchor}
                dominantBaseline="middle"
                className="fill-neutral-400 text-[10px]"
              >
                {truncate(s.label)} ({s.count})
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/** How many moving projects show before "Show more" — the rest are fine, so they shouldn't compete for attention. */
const MOVING_PREVIEW = 5

/**
 * Projects, by what they need from you — not by percent complete. A percentage was mostly a row of identical
 * empty circles, cut off names, and it dropped every time you added a next action (progress going backwards for
 * doing the right thing). This leads with the projects that are stuck, then shows each moving project's actual
 * next step.
 */
function ProjectOverview({
  activeProjects,
  completedProjects,
  actions,
  stalledProjectIds,
  onOpen,
}: {
  activeProjects: Project[]
  completedProjects: Project[]
  actions: Action[]
  stalledProjectIds: Set<string>
  onOpen: (id: string) => void
}) {
  const [showAllMoving, setShowAllMoving] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)

  if (activeProjects.length === 0 && completedProjects.length === 0) {
    return (
      <div className="mb-6 rounded-lg border border-dashed border-neutral-800 p-8 text-center text-sm text-neutral-500">
        No active projects yet.
      </div>
    )
  }

  // Same order as the Projects list, so the two screens read alike.
  const byOrder = (a: Project, b: Project) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt)
  const stalled = activeProjects.filter((p) => stalledProjectIds.has(p.id)).sort(byOrder)
  const moving = activeProjects.filter((p) => !stalledProjectIds.has(p.id)).sort(byOrder)
  const shownMoving = showAllMoving ? moving : moving.slice(0, MOVING_PREVIEW)

  const today = startOfToday()
  const summaryOf = (p: Project) => {
    const mine = actions.filter((a) => a.projectId === p.id)
    const nexts = mine
      .filter((a) => a.status === 'next')
      .sort((a, b) => Number(b.bigThreeDate === today) - Number(a.bigThreeDate === today) || a.order - b.order)
    return {
      next: nexts[0],
      waiting: mine.filter((a) => a.status === 'waiting'),
      allDone: mine.length > 0 && mine.every((a) => a.status === 'done'),
    }
  }

  const monthStart = new Date(today)
  monthStart.setDate(1)
  const finishedThisMonth = completedProjects.filter((p) => (p.completedAt ?? 0) >= monthStart.getTime()).length
  const completedNewestFirst = [...completedProjects].sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))

  return (
    <div className="mb-6 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <h2 className="mb-3 text-sm font-medium text-neutral-300">Projects</h2>

      {stalled.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-1.5 text-xs font-medium text-amber-400">Needs a next step · {stalled.length}</h3>
          <div className="flex flex-col gap-1">
            {stalled.map((p) => (
              <button
                key={p.id}
                onClick={() => onOpen(p.id)}
                className="flex w-full items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-left hover:bg-amber-500/15"
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-neutral-950">
                  !
                </span>
                <span className="max-w-[45%] shrink-0 truncate text-sm font-medium text-neutral-100" title={p.title}>
                  {p.title}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-amber-300">
                  {stalledMessage(summaryOf(p).allDone)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {moving.length > 0 && (
        <div>
          <h3 className="mb-1.5 text-xs font-medium text-neutral-500">Moving · {moving.length}</h3>
          <div className="flex flex-col gap-1">
            {shownMoving.map((p) => {
              const { next, waiting } = summaryOf(p)
              const line = next
                ? next.title
                : waiting[0]
                  ? `Waiting on ${waiting[0].waitingOn ?? 'someone'}: ${waiting[0].title}`
                  : ''
              return (
                <button
                  key={p.id}
                  onClick={() => onOpen(p.id)}
                  className="flex w-full items-center gap-2 rounded-md bg-neutral-800/50 px-2.5 py-2 text-left hover:bg-neutral-800"
                >
                  <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                  <span className="max-w-[45%] shrink-0 truncate text-sm font-medium text-neutral-100" title={p.title}>
                    {p.title}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-neutral-400" title={line}>
                    {line}
                  </span>
                  {next && waiting.length > 0 && (
                    <span className="shrink-0 rounded-md border border-neutral-700 px-1.5 py-0.5 text-[11px] text-neutral-400">
                      {waiting.length} waiting
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          {moving.length > MOVING_PREVIEW && (
            <button
              onClick={() => setShowAllMoving((v) => !v)}
              className="mt-2 text-xs text-neutral-500 hover:text-neutral-300"
            >
              {showAllMoving ? 'Show fewer' : `Show ${moving.length - MOVING_PREVIEW} more`}
            </button>
          )}
        </div>
      )}

      {activeProjects.length === 0 && <p className="text-sm text-neutral-500">No active projects yet.</p>}

      {completedProjects.length > 0 && (
        <div className="mt-4 border-t border-neutral-800 pt-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCompleted((v) => !v)}
              className="flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-300"
            >
              <span className="text-[10px]">{showCompleted ? '▾' : '▸'}</span>
              {completedProjects.length} completed
            </button>
            {finishedThisMonth > 0 && <span className="text-xs text-emerald-400">{finishedThisMonth} finished this month</span>}
          </div>
          {showCompleted && (
            <div className="mt-2 flex flex-col gap-1">
              {completedNewestFirst.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onOpen(p.id)}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs text-neutral-500 hover:bg-neutral-800"
                >
                  <span className="text-emerald-500">✓</span>
                  <span className="min-w-0 flex-1 truncate" title={p.title}>
                    {p.title}
                  </span>
                  {p.completedAt && <span className="shrink-0 text-neutral-600">{formatShortDate(p.completedAt)}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StaleNextActions({
  stale,
  onViewAll,
}: {
  stale: { action: Action; days: number }[]
  onViewAll: () => void
}) {
  const over7 = stale.length
  const over14 = stale.filter((x) => x.days > 14).length
  const over30 = stale.filter((x) => x.days > 30).length

  return (
    <div className="mb-6 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <div className="mb-3 flex items-center gap-1.5">
        <h2 className="text-sm font-medium text-neutral-300">Stale Next Actions</h2>
        <span
          title="Next Actions that haven't been touched (created, edited, or reclarified) in a while — a sign they need a decision, a break-down, or a delete."
          className="cursor-help text-xs text-neutral-500 hover:text-neutral-300"
        >
          ⓘ
        </span>
      </div>

      {over7 === 0 ? (
        <p className="text-sm text-neutral-500">Nothing stale — every Next Action has been touched this week.</p>
      ) : (
        <>
          <div className="flex gap-3">
            <StaleTile label="7+ days" count={over7} color={STALE_TIER_COLOR[7]} />
            <StaleTile label="14+ days" count={over14} color={STALE_TIER_COLOR[14]} />
            <StaleTile label="30+ days" count={over30} color={STALE_TIER_COLOR[30]} />
          </div>
          <button onClick={onViewAll} className="mt-3 text-xs text-emerald-400 hover:text-emerald-300">
            View Next Actions →
          </button>
        </>
      )}
    </div>
  )
}

function StaleTile({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex-1 rounded-md border border-neutral-800 bg-neutral-950 p-3 text-center">
      <div className="text-2xl font-semibold" style={{ color }}>
        {count}
      </div>
      <div className="mt-0.5 text-xs text-neutral-500">{label}</div>
    </div>
  )
}

function WaitingForAging({ actions, onViewAll }: { actions: Action[]; onViewAll: () => void }) {
  const shown = actions.slice(0, 5)

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <h2 className="mb-3 text-sm font-medium text-neutral-300">Waiting For — longest since contact</h2>

      {shown.length === 0 && <p className="text-sm text-neutral-500">Nothing pending on anyone else.</p>}

      <div className="flex flex-col gap-2">
        {shown.map((a) => {
          const days = ageInDays(lastContactAt(a))
          return (
            <div key={a.id} className="flex items-center gap-2 text-sm">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: ageColor(days) }}
                title={`${ageLabel(days)} since ${a.followUps?.length ? 'you last followed up' : 'you started waiting'}`}
              />
              <span className="flex-1 truncate text-neutral-200">{a.title}</span>
              {a.waitingOn && <span className="shrink-0 text-neutral-500">on {a.waitingOn}</span>}
              <span className="shrink-0 text-xs text-neutral-500">{ageLabel(days)}</span>
            </div>
          )
        })}
      </div>

      {actions.length > shown.length && (
        <button onClick={onViewAll} className="mt-3 text-xs text-emerald-400 hover:text-emerald-300">
          View all {actions.length} →
        </button>
      )}
    </div>
  )
}
