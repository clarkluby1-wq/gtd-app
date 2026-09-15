import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from '../db/db'
import { useSomedayProjectIds } from '../lib/useSomedayProjectIds'
import type { Action, AreaOfFocus, Project } from '../db/types'

const ACCENT = '#10b981' // emerald-500 — this app's existing brand accent
const TRACK = '#262626' // neutral-800 — existing unfilled-track color used elsewhere
const GRID = '#2c2c2a'
const STATUS = { good: '#0ca30c', warning: '#fab219', critical: '#d03b3b' }

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function ageInDays(createdAt: number) {
  return Math.floor((Date.now() - createdAt) / (1000 * 60 * 60 * 24))
}

function ageColor(days: number) {
  if (days < 3) return STATUS.good
  if (days <= 7) return STATUS.warning
  return STATUS.critical
}

function ageLabel(days: number) {
  if (days === 0) return 'today'
  if (days === 1) return '1 day'
  return `${days} days`
}

export function DashboardView({
  onOpenProject,
  onViewWaitingFor,
}: {
  onOpenProject: (id: string) => void
  onViewWaitingFor: () => void
}) {
  const areas = useLiveQuery(() => db.areasOfFocus.orderBy('order').toArray())
  const activeProjects = useLiveQuery(() => db.projects.where('status').equals('active').toArray())
  const allActions = useLiveQuery(() => db.actions.toArray())
  const waitingActionsRaw = useLiveQuery(() => db.actions.where('status').equals('waiting').toArray())
  const somedayProjectIds = useSomedayProjectIds()

  const waitingActions = useMemo(() => {
    return (waitingActionsRaw ?? [])
      .filter((a) => !a.projectId || !somedayProjectIds.has(a.projectId))
      .sort((a, b) => a.createdAt - b.createdAt)
  }, [waitingActionsRaw, somedayProjectIds])

  const progress = (projectId: string) => {
    const items = allActions?.filter((a) => a.projectId === projectId) ?? []
    const done = items.filter((a) => a.status === 'done').length
    return { done, total: items.length }
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-1 text-xl font-semibold text-neutral-100">Dashboard</h1>
      <p className="mb-6 text-sm text-neutral-500">A glance at the whole system, not just one list.</p>

      <BalanceWheel areas={areas ?? []} projects={activeProjects ?? []} />

      <ProjectRings projects={activeProjects ?? []} progress={progress} onOpen={onOpenProject} />

      <WaitingForAging actions={waitingActions} onViewAll={onViewWaitingFor} />
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

function ProjectRings({
  projects,
  progress,
  onOpen,
}: {
  projects: Project[]
  progress: (id: string) => { done: number; total: number }
  onOpen: (id: string) => void
}) {
  if (projects.length === 0) {
    return (
      <div className="mb-6 rounded-lg border border-dashed border-neutral-800 p-8 text-center text-sm text-neutral-500">
        No active projects yet.
      </div>
    )
  }

  return (
    <div className="mb-6 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <h2 className="mb-3 text-sm font-medium text-neutral-300">Project Progress</h2>
      <div className="flex flex-wrap gap-4">
        {projects.map((p) => (
          <ProjectRing key={p.id} project={p} progress={progress(p.id)} onOpen={() => onOpen(p.id)} />
        ))}
      </div>
    </div>
  )
}

function ProjectRing({
  project,
  progress,
  onOpen,
}: {
  project: Project
  progress: { done: number; total: number }
  onOpen: () => void
}) {
  const { done, total } = progress
  const pct = total > 0 ? done / total : 0
  const r = 30
  const circumference = 2 * Math.PI * r

  return (
    <button onClick={onOpen} className="flex w-20 flex-col items-center gap-1 text-center" title={project.title}>
      <svg viewBox="0 0 72 72" className="h-16 w-16">
        <circle cx={36} cy={36} r={r} fill="none" stroke={TRACK} strokeWidth={7} />
        <circle
          cx={36}
          cy={36}
          r={r}
          fill="none"
          stroke={ACCENT}
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
          transform="rotate(-90 36 36)"
        />
        <text x={36} y={40} textAnchor="middle" className="fill-neutral-100 text-[15px] font-semibold">
          {Math.round(pct * 100)}%
        </text>
      </svg>
      <span className="w-full truncate text-xs text-neutral-400">{project.title}</span>
    </button>
  )
}

function WaitingForAging({ actions, onViewAll }: { actions: Action[]; onViewAll: () => void }) {
  const shown = actions.slice(0, 5)

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <h2 className="mb-3 text-sm font-medium text-neutral-300">Waiting For — oldest first</h2>

      {shown.length === 0 && <p className="text-sm text-neutral-500">Nothing pending on anyone else.</p>}

      <div className="flex flex-col gap-2">
        {shown.map((a) => {
          const days = ageInDays(a.createdAt)
          return (
            <div key={a.id} className="flex items-center gap-2 text-sm">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: ageColor(days) }}
                title={`${ageLabel(days)} old`}
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
