import { closestCenter, DndContext } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { db } from '../db/db'
import { v4 as uuid } from 'uuid'
import { DeepPlanModal } from '../components/DeepPlanModal'
import { FixOneModal } from '../components/FixOneModal'
import { completeProject, reopenProject, setProjectFocus, updateProject } from '../db/operations'
import { celebrate, originOf } from '../lib/celebrate'
import { showUndo } from '../lib/undoSnack'
import { SimilarNotice } from '../components/SimilarNotice'
import { formatShortDate } from '../lib/date'
import { isProjectStalled, nextStepOf, stalledMessage } from '../lib/projectHealth'
import { PROJECT_FOCUS_MAX, PROJECT_FOCUS_MAX_WORD } from '../lib/projectFocus'
import { useEscapeKey } from '../lib/useEscapeKey'
import { useFeatures } from '../lib/levels'
import { useSimilarExisting } from '../lib/useSimilarExisting'
import { useDragReorder } from '../lib/useDragReorder'
import type { Project } from '../db/types'

type ViewMode = 'list' | 'tiles'
const VIEW_KEY = 'gtd.projects.view'

function readViewMode(): ViewMode {
  try {
    return localStorage.getItem(VIEW_KEY) === 'tiles' ? 'tiles' : 'list'
  } catch {
    return 'list'
  }
}

/** Projects created before `order` existed fall back to their creation time. */
type OrderedProject = Project & { order: number }

type NextStep = ReturnType<typeof nextStepOf>

export function ProjectsView({ onOpen }: { onOpen: (projectId: string) => void }) {
  const projectsRaw = useLiveQuery(() => db.projects.where('status').equals('active').toArray())
  const projects = useMemo(
    (): OrderedProject[] =>
      (projectsRaw ?? []).map((p) => ({ ...p, order: p.order ?? p.createdAt })).sort((a, b) => a.order - b.order),
    [projectsRaw],
  )
  const allActions = useLiveQuery(() => db.actions.toArray())
  const [creating, setCreating] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>(readViewMode)
  // Which tiles have their details open. Tiles start collapsed, so a page of projects reads as a calm list of names.
  const [openTiles, setOpenTiles] = useState<Set<string>>(new Set())
  const toggleTile = (id: string) =>
    setOpenTiles((prev) => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })
  const chooseView = (mode: ViewMode) => {
    setViewMode(mode)
    try {
      localStorage.setItem(VIEW_KEY, mode)
    } catch {
      // Not remembering is fine; it just opens as a list next time.
    }
  }
  const features = useFeatures()
  const [deepPlanning, setDeepPlanning] = useState(false)
  const [fixing, setFixing] = useState(false)
  const [title, setTitle] = useState('')
  const [outcome, setOutcome] = useState('')
  const [status, setStatus] = useState<'active' | 'someday'>('active')
  const similar = useSimilarExisting(creating ? title : '')

  // The few you're pushing on sit up top; everything else tucks away behind one tap. With nothing in focus yet there's
  // nothing to hide behind, so the whole list simply shows.
  const focused = useMemo(
    () => projects.filter((p) => p.focusedAt !== undefined).sort((a, b) => a.focusedAt! - b.focusedAt!),
    [projects],
  )
  const rest = useMemo(() => projects.filter((p) => p.focusedAt === undefined), [projects])
  const focusFull = focused.length >= PROJECT_FOCUS_MAX
  const [showRestChoice, setShowRestChoice] = useState<boolean | null>(null)
  const restOpen = showRestChoice ?? focused.length === 0

  const { sensors, handleDragEnd } = useDragReorder(rest, (id, order) => {
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

  // Pinning from the list keeps that list open: you're probably picking several in a row, so it shouldn't vanish after the first.
  const pinFromRest = (id: string) => {
    setShowRestChoice(true)
    void setProjectFocus(id, true)
  }

  // Finishing a project is one tap from here, with an Undo instead of a "are you sure?" — a wrong tap is easy to reverse.
  const finishProject = (p: OrderedProject, from: Element) => {
    celebrate(originOf(from), 'big')
    void completeProject(p.id)
    showUndo(`Completed “${p.title}”`, () => void reopenProject(p.id))
  }

  const tileFor = (p: OrderedProject, isFocused: boolean) => (
    <ProjectTile
      key={p.id}
      project={p}
      progress={progress(p.id)}
      stalled={stalledIds.has(p.id)}
      nextStep={allActions ? nextStepOf(p, allActions) : undefined}
      focused={isFocused}
      focusDisabled={!isFocused && focusFull}
      onToggleFocus={() => (isFocused ? void setProjectFocus(p.id, false) : pinFromRest(p.id))}
      onComplete={(el) => finishProject(p, el)}
      expanded={openTiles.has(p.id)}
      onToggle={() => toggleTile(p.id)}
      onOpen={() => onOpen(p.id)}
    />
  )

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="flex items-center gap-1.5 text-xl font-semibold text-neutral-100">
          Projects
          <span
            title={`Any outcome that requires more than one action. Each project needs a defined outcome and a next action. Pick up to ${PROJECT_FOCUS_MAX_WORD} to focus on and the rest tuck away. Your Projects list should only contain things you're genuinely resourcing right now, so it stays trustworthy and doesn't create guilt/noise from stuff you're not really moving on.`}
            className="cursor-help text-sm text-neutral-500 hover:text-neutral-300"
          >
            ⓘ
          </span>
        </h1>
        <div className="flex items-center gap-2">
          <ViewMenu
            viewMode={viewMode}
            onChooseView={chooseView}
            canExpandAll={viewMode === 'tiles' && restOpen && rest.length > 0}
            anyOpen={openTiles.size > 0}
            onToggleAll={() => setOpenTiles(openTiles.size > 0 ? new Set() : new Set(rest.map((p) => p.id)))}
            onDeepPlan={features.has('planning') ? () => setDeepPlanning(true) : undefined}
          />
          <button
            onClick={() => setCreating((v) => !v)}
            className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
          >
            + New Project
          </button>
        </div>
      </div>

      {stalledIds.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-amber-300/80">
            {stalledIds.size === 1 ? 'One project needs a first step.' : 'Some projects need a first step.'}
          </span>
          <button
            onClick={() => setFixing(true)}
            className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-200 hover:bg-amber-500/25"
          >
            Fix one →
          </button>
        </div>
      )}

      {creating && (
        <div className="mb-6 flex max-w-2xl flex-col gap-2 rounded-2xl bg-neutral-900 p-5">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Project title"
            className="rounded-xl border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
          />
          <SimilarNotice match={similar} />
          <textarea
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            rows={2}
            placeholder='Outcome — what does "done" look like?'
            className="rounded-xl border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
          />
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setStatus('active')}
              className={`flex-1 rounded-xl px-3 py-2 text-xs font-medium ${
                status === 'active' ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-300'
              }`}
            >
              Active — committed now
            </button>
            <button
              type="button"
              onClick={() => setStatus('someday')}
              className={`flex-1 rounded-xl px-3 py-2 text-xs font-medium ${
                status === 'someday' ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-300'
              }`}
            >
              Someday — not committed yet
            </button>
          </div>
          <button
            onClick={createProject}
            className="self-start rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
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

      {focused.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-medium text-neutral-400">
            In focus · {focused.length} of {PROJECT_FOCUS_MAX}
          </h2>
          <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {focused.map((p) => tileFor(p, true))}
          </div>
        </section>
      )}

      {focused.length === 0 && projects.length > 0 && (
        <p className="mb-4 text-xs text-neutral-500">
          Tap 📌 on up to {PROJECT_FOCUS_MAX_WORD} projects to keep them front and centre — the rest can tuck away.
        </p>
      )}

      {focused.length > 0 && rest.length > 0 && (
        <button
          onClick={() => setShowRestChoice(!restOpen)}
          aria-expanded={restOpen}
          className="mb-3 text-sm text-neutral-400 hover:text-neutral-200"
        >
          {restOpen ? '▾' : '▸'} {rest.length} more project{rest.length === 1 ? '' : 's'}
        </button>
      )}

      {restOpen && rest.length > 0 && (
        viewMode === 'tiles' ? (
          <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((p) => tileFor(p, false))}
          </div>
        ) : (
          <div className="max-w-2xl">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={rest.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-2">
                  {rest.map((p) => (
                    <SortableProjectCard
                      key={p.id}
                      project={p}
                      progress={progress(p.id)}
                      stalled={stalledIds.has(p.id)}
                      focusDisabled={focusFull}
                      onFocus={() => pinFromRest(p.id)}
                      onComplete={(el) => finishProject(p, el)}
                      onOpen={() => onOpen(p.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        )
      )}

      {fixing && <FixOneModal onClose={() => setFixing(false)} />}

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

/** The page's few settings in one quiet menu, so the header stays calm. */
function ViewMenu({
  viewMode,
  onChooseView,
  canExpandAll,
  anyOpen,
  onToggleAll,
  onDeepPlan,
}: {
  viewMode: ViewMode
  onChooseView: (mode: ViewMode) => void
  canExpandAll: boolean
  anyOpen: boolean
  onToggleAll: () => void
  onDeepPlan?: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEscapeKey(() => setOpen(false), open)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const item = 'block w-full rounded-xl px-3 py-1.5 text-left text-xs hover:bg-neutral-700'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="rounded-full bg-neutral-800 px-4 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-700"
      >
        View ▾
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-52 rounded-2xl bg-neutral-800 p-1.5 shadow-xl">
          <div className="px-3 pb-1 pt-1.5 text-[10px] uppercase tracking-wide text-neutral-600">Show the rest as</div>
          {(['list', 'tiles'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => {
                onChooseView(mode)
                setOpen(false)
              }}
              aria-pressed={viewMode === mode}
              className={`${item} ${viewMode === mode ? 'text-emerald-300' : 'text-neutral-300'}`}
            >
              {viewMode === mode ? '✓ ' : ''}
              {mode === 'list' ? '☰ List' : '▦ Tiles'}
            </button>
          ))}
          {canExpandAll && (
            <button
              onClick={() => {
                onToggleAll()
                setOpen(false)
              }}
              className={`${item} text-neutral-300`}
            >
              {anyOpen ? 'Collapse all details' : 'Expand all details'}
            </button>
          )}
          {onDeepPlan && (
            <>
              <div className="my-1 h-px bg-neutral-700/50" />
              <button
                onClick={() => {
                  setOpen(false)
                  onDeepPlan()
                }}
                title="Walk through Purpose, Vision, Brainstorm, Organize, and Next Actions"
                className={`${item} text-neutral-300`}
              >
                🧭 Deep Plan
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function SortableProjectCard({
  project,
  progress,
  stalled,
  focusDisabled,
  onFocus,
  onComplete,
  onOpen,
}: {
  project: OrderedProject
  progress: { done: number; total: number }
  stalled: boolean
  focusDisabled: boolean
  onFocus: () => void
  onComplete: (from: Element) => void
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
      className={`group flex items-start gap-2 rounded-2xl p-4 ${
        stalled ? 'bg-amber-500/[0.07]' : 'bg-neutral-900 hover:bg-neutral-800/70'
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        style={{ touchAction: 'none' }}
        className="mt-0.5 shrink-0 cursor-grab touch-reveal text-neutral-600 hover:text-neutral-300 active:cursor-grabbing"
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
                className="h-2 w-2 shrink-0 rounded-full bg-amber-400/90"
              />
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
        {stalled && <p className="mt-2 text-xs text-amber-300/80">{message}</p>}
      </button>
      <button
        onClick={(e) => onComplete(e.currentTarget)}
        aria-label="Mark this project complete"
        title="Mark complete"
        className={
          allDone
            ? 'mt-0.5 shrink-0 rounded-full bg-emerald-600/15 px-2.5 py-0.5 text-xs font-medium text-emerald-300 hover:bg-emerald-600 hover:text-white'
            : 'touch-reveal mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-neutral-600 text-[10px] text-transparent hover:border-emerald-500 hover:bg-emerald-600 hover:text-white'
        }
      >
        {allDone ? '✓ Finish' : '✓'}
      </button>
      <button
        onClick={onFocus}
        disabled={focusDisabled}
        aria-label="Focus on this project"
        title={
          focusDisabled
            ? `Focus is full (${PROJECT_FOCUS_MAX_WORD}) — take one off first`
            : `Focus on this project (up to ${PROJECT_FOCUS_MAX_WORD})`
        }
        className="mt-0.5 shrink-0 text-sm opacity-40 hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-20 disabled:hover:opacity-20"
      >
        📌
      </button>
    </div>
  )
}

/**
 * A project as a tile. In focus it's a bigger tile that always shows the very next step; otherwise it's just the name
 * (plus the amber "!" when nothing is in motion), and the arrow opens the details. The name opens the project.
 */
function ProjectTile({
  project,
  progress,
  stalled,
  nextStep,
  focused,
  focusDisabled,
  onToggleFocus,
  onComplete,
  expanded,
  onToggle,
  onOpen,
}: {
  project: OrderedProject
  progress: { done: number; total: number }
  stalled: boolean
  nextStep: NextStep
  focused: boolean
  focusDisabled: boolean
  onToggleFocus: () => void
  onComplete: (from: Element) => void
  expanded: boolean
  onToggle: () => void
  onOpen: () => void
}) {
  const { done, total } = progress
  const message = stalledMessage(total > 0 && done === total)
  const step = nextStep?.action
  const prefix =
    step?.status === 'waiting'
      ? `Waiting on ${step.waitingOn ?? 'someone'}: `
      : step?.status === 'scheduled' && step.scheduledDate != null
        ? `${formatShortDate(step.scheduledDate)}: `
        : ''
  const showDetails = focused || expanded

  return (
    <div
      id={`project-${project.id}`}
      className={`group rounded-2xl ${
        stalled ? 'bg-amber-500/[0.07]' : focused ? 'bg-emerald-950/30' : 'bg-neutral-900 hover:bg-neutral-800/70'
      }`}
    >
      <div className={`flex items-start gap-1 ${focused ? 'p-5 pb-2' : 'p-4 pb-3'}`}>
        <button
          onClick={onOpen}
          title="Open this project"
          className={`flex min-w-0 flex-1 items-start gap-2 text-left font-medium text-stone-100 hover:underline ${
            focused ? 'text-base' : ''
          }`}
        >
          <span className="line-clamp-2">{project.title}</span>
          {stalled && (
            <span
              title={`${project.title} — ${message}`}
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-400/90"
            />
          )}
        </button>
        <button
          onClick={(e) => onComplete(e.currentTarget)}
          aria-label="Mark this project complete"
          title="Mark complete"
          className="touch-reveal -mt-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm text-neutral-500 hover:bg-emerald-600 hover:text-white"
        >
          ✓
        </button>
        <button
          onClick={onToggleFocus}
          disabled={focusDisabled}
          aria-pressed={focused}
          aria-label={focused ? 'Take out of focus' : 'Focus on this project'}
          title={
            focused
              ? 'In focus — tap to take it out'
              : focusDisabled
                ? `Focus is full (${PROJECT_FOCUS_MAX_WORD}) — take one off first`
                : `Focus on this project (up to ${PROJECT_FOCUS_MAX_WORD})`
          }
          className={`-mt-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-20 disabled:hover:bg-transparent ${
            focused ? 'bg-emerald-600/20' : 'opacity-40 hover:opacity-100'
          }`}
        >
          📌
        </button>
        {!focused && (
          <button
            onClick={onToggle}
            aria-expanded={expanded}
            aria-label={expanded ? 'Hide details' : 'Show details'}
            title={expanded ? 'Hide details' : 'Show details'}
            className="-mr-2 -mt-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
          >
            {expanded ? '▾' : '▸'}
          </button>
        )}
      </div>

      {stalled && (
        <div className={`flex flex-wrap items-center gap-2 pb-4 ${focused ? 'px-5' : 'px-4'}`}>
          <p className="text-xs text-amber-300/80">{message}</p>
          {total > 0 && done === total && (
            <button
              onClick={(e) => onComplete(e.currentTarget)}
              className="rounded-full bg-emerald-600/15 px-3 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-600 hover:text-white"
            >
              ✓ Finish
            </button>
          )}
        </div>
      )}

      {showDetails && !(stalled && focused) && (
        <div className={`flex flex-col gap-2 text-sm ${focused ? 'px-5 pb-5' : 'px-4 pb-4'}`}>
          {!focused && project.outcome && <p className="text-neutral-400">{project.outcome}</p>}
          {!focused && (
            <p className="text-xs text-neutral-500">
              {total === 0 ? 'No steps yet' : `${done} of ${total} step${total === 1 ? '' : 's'} done`}
            </p>
          )}
          {step && (
            <p className="text-neutral-300">
              <span className="text-neutral-500">Next: </span>
              {prefix}
              {step.title}
              {nextStep && nextStep.more > 0 && <span className="text-xs text-neutral-600"> +{nextStep.more} more</span>}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
