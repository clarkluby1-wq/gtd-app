import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { db } from '../db/db'
import { BigThree } from '../components/BigThree'
import { useSomedayProjectIds } from '../lib/useSomedayProjectIds'
import { ageInDays, ageLabel, staleNextActions } from '../lib/staleness'
import { lastContactAt } from '../lib/waiting'
import { isProjectStalled } from '../lib/projectHealth'
import { startOfToday } from '../lib/date'
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
  onViewProjects,
}: {
  onOpenProject: (id: string) => void
  onViewWaitingFor: () => void
  onViewNextActions: () => void
  onViewProjects: () => void
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

      <ProjectSummary
        activeProjects={activeProjects ?? []}
        completedProjects={completedProjects ?? []}
        stalledProjectIds={stalledProjectIds}
        onViewProjects={onViewProjects}
        onOpen={onOpenProject}
      />

      <StaleNextActions stale={staleActions} onViewAll={onViewNextActions} />

      <WaitingForAging actions={waitingActions} onViewAll={onViewWaitingFor} />
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

/**
 * Projects at a glance: two numbers and a collapsed list of finished ones. The detail lives on the Projects
 * page — a dashboard is for noticing, not for reading. "Moving" means it has a next action or a wait in
 * progress, the same rule the stalled flag uses everywhere else.
 */
function ProjectSummary({
  activeProjects,
  completedProjects,
  stalledProjectIds,
  onViewProjects,
  onOpen,
}: {
  activeProjects: Project[]
  completedProjects: Project[]
  stalledProjectIds: Set<string>
  onViewProjects: () => void
  onOpen: (id: string) => void
}) {
  const [showCompleted, setShowCompleted] = useState(false)

  if (activeProjects.length === 0 && completedProjects.length === 0) {
    return (
      <div className="mb-6 rounded-lg border border-dashed border-neutral-800 p-8 text-center text-sm text-neutral-500">
        No active projects yet.
      </div>
    )
  }

  const needNextStep = activeProjects.filter((p) => stalledProjectIds.has(p.id)).length
  const moving = activeProjects.length - needNextStep

  return (
    <div className="mb-6 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-neutral-300">Projects</h2>
        <span className="text-xs text-neutral-500">{activeProjects.length} active</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onViewProjects}
          title="Projects with a next action, or waiting on someone"
          className="rounded-md bg-neutral-800/50 px-3 py-3 text-left hover:bg-neutral-800"
        >
          <div className="text-2xl font-semibold text-neutral-100">{moving}</div>
          <div className="text-xs text-neutral-500">Moving</div>
        </button>
        <button
          onClick={onViewProjects}
          title="Projects with nothing next and nothing pending"
          className={`rounded-md px-3 py-3 text-left ${
            needNextStep > 0
              ? 'border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/15'
              : 'bg-neutral-800/50 hover:bg-neutral-800'
          }`}
        >
          <div className={`text-2xl font-semibold ${needNextStep > 0 ? 'text-amber-400' : 'text-neutral-100'}`}>
            {needNextStep}
          </div>
          <div className={`text-xs ${needNextStep > 0 ? 'text-amber-300' : 'text-neutral-500'}`}>
            Need a next step
          </div>
        </button>
      </div>

      {completedProjects.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setShowCompleted((v) => !v)}
            className="flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-300"
          >
            <span className="text-[10px]">{showCompleted ? '▾' : '▸'}</span>
            {completedProjects.length} completed
          </button>
          {showCompleted && (
            <ul className="mt-2 flex flex-col gap-0.5">
              {completedProjects.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => onOpen(p.id)}
                    className="w-full truncate rounded px-2 py-1 text-left text-xs text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
                    title={p.title}
                  >
                    {p.title}
                  </button>
                </li>
              ))}
            </ul>
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
