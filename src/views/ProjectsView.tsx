import { closestCenter, DndContext } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useRef, useState } from 'react'
import { db } from '../db/db'
import { v4 as uuid } from 'uuid'
import { DeepPlanModal } from '../components/DeepPlanModal'
import { updateProject } from '../db/operations'
import { isProjectStalled, stalledMessage } from '../lib/projectHealth'
import { useDragReorder } from '../lib/useDragReorder'
import type { Project } from '../db/types'

/** Projects created before `order` existed fall back to their creation time. */
type OrderedProject = Project & { order: number }

export function ProjectsView({ onOpen }: { onOpen: (projectId: string) => void }) {
  const projectsRaw = useLiveQuery(() => db.projects.where('status').equals('active').toArray())
  const projects = useMemo(
    (): OrderedProject[] =>
      (projectsRaw ?? []).map((p) => ({ ...p, order: p.order ?? p.createdAt })).sort((a, b) => a.order - b.order),
    [projectsRaw],
  )
  const allActions = useLiveQuery(() => db.actions.toArray())
  const [creating, setCreating] = useState(false)
  const [deepPlanning, setDeepPlanning] = useState(false)
  const [title, setTitle] = useState('')
  const [outcome, setOutcome] = useState('')
  const [status, setStatus] = useState<'active' | 'someday'>('active')

  const { sensors, handleDragEnd } = useDragReorder(projects, (id, order) => {
    void updateProject(id, { order })
  })

  const progress = (projectId: string) => {
    const items = allActions?.filter((a) => a.projectId === projectId) ?? []
    const done = items.filter((a) => a.status === 'done').length
    return { done, total: items.length }
  }

  // Same rule as the Dashboard's "Stalled" section, so the two screens can never disagree.
  const stalledIds = useMemo(
    () => new Set(allActions ? projects.filter((p) => isProjectStalled(p, allActions)).map((p) => p.id) : []),
    [projects, allActions],
  )

  // "Needs a next step" is also a shortcut: it scrolls to the first such project, and to the next one on each click.
  const stalledInOrder = projects.filter((p) => stalledIds.has(p.id))
  const [tourIndex, setTourIndex] = useState<number | null>(null)
  const [flashId, setFlashId] = useState<string | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const jumpToStalled = () => {
    const count = stalledInOrder.length
    if (count === 0) return
    const next = tourIndex === null ? 0 : (tourIndex + 1) % count
    const target = stalledInOrder[next]
    setTourIndex(next)
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    document.getElementById(`project-${target.id}`)?.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'center' })
    // A soft glow so the eye lands on it.
    setFlashId(target.id)
    clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setFlashId(null), 1800)
  }

  const createProject = async () => {
    if (!title.trim()) return
    const now = Date.now()
    const project: Project = {
      id: uuid(),
      title: title.trim(),
      outcome: outcome.trim(),
      status,
      createdAt: now,
      order: now,
    }
    await db.projects.add(project)
    setTitle('')
    setOutcome('')
    setCreating(false)
    if (status === 'active') onOpen(project.id)
    setStatus('active')
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="flex items-center gap-1.5 text-xl font-semibold text-neutral-100">
          Projects
          <span
            title="Your Projects list should only contain things you're genuinely resourcing right now, so it stays trustworthy and doesn't create guilt/noise from stuff you're not really moving on."
            className="cursor-help text-sm text-neutral-500 hover:text-neutral-300"
          >
            ⓘ
          </span>
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => setDeepPlanning(true)}
            className="rounded-md bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-700"
            title="Walk through Purpose, Vision, Brainstorm, Organize, and Next Actions"
          >
            🧭 Deep Plan
          </button>
          <button
            onClick={() => setCreating((v) => !v)}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
          >
            + New Project
          </button>
        </div>
      </div>
      <p className="mb-4 text-sm text-neutral-500">
        Any outcome that requires more than one action. Each project needs a defined outcome and a next action.
      </p>

      {stalledIds.size > 0 && (
        <div className="sticky top-0 z-10 -mx-2 mb-2 bg-neutral-950 px-2 py-2">
          <button
            onClick={jumpToStalled}
            title="Jump to the projects that need a next step"
            className="text-xs text-amber-400 hover:text-amber-300"
          >
            Needs a next step · {stalledIds.size > 1 && tourIndex !== null ? `${Math.min(tourIndex, stalledIds.size - 1) + 1} of ${stalledIds.size} — next` : stalledIds.size} ↓
          </button>
        </div>
      )}

      {creating && (
        <div className="mb-6 flex flex-col gap-2 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Project title"
            className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
          />
          <textarea
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            rows={2}
            placeholder='Outcome — what does "done" look like?'
            className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
          />
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setStatus('active')}
              className={`flex-1 rounded-md px-3 py-2 text-xs font-medium ${
                status === 'active' ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-300'
              }`}
            >
              Active — committed now
            </button>
            <button
              type="button"
              onClick={() => setStatus('someday')}
              className={`flex-1 rounded-md px-3 py-2 text-xs font-medium ${
                status === 'someday' ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-300'
              }`}
            >
              Someday — not committed yet
            </button>
          </div>
          <button
            onClick={createProject}
            className="self-start rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
          >
            Create
          </button>
        </div>
      )}

      {projects.length === 0 && !creating && (
        <div className="rounded-lg border border-dashed border-neutral-800 p-8 text-center text-sm text-neutral-500">
          No active projects yet.
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={projects.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {projects.map((p) => (
              <SortableProjectCard
                key={p.id}
                project={p}
                progress={progress(p.id)}
                stalled={stalledIds.has(p.id)}
                flash={flashId === p.id}
                onOpen={() => onOpen(p.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {deepPlanning && (
        <DeepPlanModal
          onClose={() => setDeepPlanning(false)}
          onCreated={(projectId) => {
            setDeepPlanning(false)
            onOpen(projectId)
          }}
        />
      )}
    </div>
  )
}

function SortableProjectCard({
  project,
  progress,
  stalled,
  flash,
  onOpen,
}: {
  project: OrderedProject
  progress: { done: number; total: number }
  stalled: boolean
  flash: boolean
  onOpen: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: project.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  const { done, total } = progress
  const allDone = total > 0 && done === total
  const message = stalledMessage(allDone)

  return (
    <div
      ref={setNodeRef}
      id={`project-${project.id}`}
      style={style}
      className={`group flex items-start gap-2 rounded-lg border bg-neutral-900 p-4 transition-shadow duration-500 ${
        stalled ? 'border-amber-500/40 hover:border-amber-500/60' : 'border-neutral-800 hover:border-neutral-700'
      } ${flash ? 'ring-2 ring-amber-400/70' : ''}`}
    >
      <button
        {...attributes}
        {...listeners}
        style={{ touchAction: 'none' }}
        className="mt-0.5 shrink-0 cursor-grab text-neutral-600 opacity-0 hover:text-neutral-300 group-hover:opacity-100 active:cursor-grabbing"
        title="Drag to reorder"
      >
        ⠿
      </button>
      <button onClick={onOpen} className="min-w-0 flex-1 text-left">
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2 font-medium text-neutral-100">
            <span className="truncate">{project.title}</span>
            {stalled && (
              <span
                title={`${project.title} — ${message}`}
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-neutral-950"
              >
                !
              </span>
            )}
          </span>
          <span className="shrink-0 text-xs text-neutral-500">
            {done}/{total}
          </span>
        </div>
        {project.outcome && <p className="mt-1 truncate text-sm text-neutral-500">{project.outcome}</p>}
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
          <div className="h-full bg-emerald-600" style={{ width: total ? `${(done / total) * 100}%` : '0%' }} />
        </div>
        {stalled && <p className="mt-2 text-xs text-amber-400">{message}</p>}
      </button>
    </div>
  )
}
