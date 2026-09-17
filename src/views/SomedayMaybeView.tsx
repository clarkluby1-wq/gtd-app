import { closestCenter, DndContext } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { db } from '../db/db'
import { updateAction, updateProject } from '../db/operations'
import { ClarifyModal } from '../components/ClarifyModal'
import { TaskRow } from '../components/TaskRow'
import { useDragReorder } from '../lib/useDragReorder'
import type { Action, Project } from '../db/types'

/** Projects created before `order` existed fall back to their creation time. */
type OrderedProject = Project & { order: number }

/**
 * A single maybe-someday possibility, action or project. GTD doesn't ask you to have
 * already decided the shape of something you haven't committed to yet, so both kinds
 * live in one merged, ordered list rather than two separate sections.
 */
type SomedayItem =
  | { kind: 'action'; id: string; order: number; action: Action }
  | { kind: 'project'; id: string; order: number; project: OrderedProject }

export function SomedayMaybeView({ onOpenProject }: { onOpenProject: (id: string) => void }) {
  const [clarifying, setClarifying] = useState<Action | null>(null)
  const actions = useLiveQuery(() => db.actions.where('status').equals('someday').sortBy('order'))
  const somedayProjectsRaw = useLiveQuery(() => db.projects.where('status').equals('someday').toArray())
  const somedayProjects = useMemo(
    (): OrderedProject[] =>
      (somedayProjectsRaw ?? []).map((p) => ({ ...p, order: p.order ?? p.createdAt })),
    [somedayProjectsRaw],
  )

  const items = useMemo<SomedayItem[]>(() => {
    const actionItems: SomedayItem[] = (actions ?? []).map((action) => ({
      kind: 'action',
      id: action.id,
      order: action.order,
      action,
    }))
    const projectItems: SomedayItem[] = somedayProjects.map((project) => ({
      kind: 'project',
      id: project.id,
      order: project.order,
      project,
    }))
    return [...actionItems, ...projectItems].sort((a, b) => a.order - b.order)
  }, [actions, somedayProjects])

  const { sensors, handleDragEnd } = useDragReorder(items, (id, order) => {
    const item = items.find((i) => i.id === id)
    if (!item) return
    if (item.kind === 'action') void updateAction(id, { order })
    else void updateProject(id, { order })
  })

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-1 text-xl font-semibold text-neutral-100">Someday / Maybe</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Not committed to right now, but not dead either. Revisit during your weekly review — activate when ready.
      </p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col divide-y divide-neutral-900">
            {items.map((item) => (
              <SortableSomedayRow
                key={item.id}
                item={item}
                onOpenProject={onOpenProject}
                onClarifyAction={setClarifying}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {items.length === 0 && (
        <div className="rounded-lg border border-dashed border-neutral-800 p-8 text-center text-sm text-neutral-500">
          Nothing parked here.
        </div>
      )}

      {clarifying && <ClarifyModal item={clarifying} onClose={() => setClarifying(null)} />}
    </div>
  )
}

function SortableSomedayRow({
  item,
  onOpenProject,
  onClarifyAction,
}: {
  item: SomedayItem
  onOpenProject: (id: string) => void
  onClarifyAction: (action: Action) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  if (item.kind === 'action') {
    return (
      <div ref={setNodeRef} style={style} className="flex items-center justify-between py-2">
        <TaskRow action={item.action} dragHandle={{ attributes, listeners }} />
        <button
          onClick={() => onClarifyAction(item.action)}
          title="Reopen Clarify — decide what this becomes now that you're ready"
          className="ml-2 shrink-0 rounded-md bg-neutral-800 px-2 py-1 text-xs text-neutral-300 hover:bg-emerald-600 hover:text-white"
        >
          Activate
        </button>
      </div>
    )
  }

  const project = item.project
  return (
    <div ref={setNodeRef} style={style} className="flex items-center justify-between py-2">
      <div className="group flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2 hover:bg-neutral-900">
        <button
          {...attributes}
          {...listeners}
          style={{ touchAction: 'none' }}
          className="shrink-0 cursor-grab text-neutral-600 opacity-0 hover:text-neutral-300 group-hover:opacity-100 active:cursor-grabbing"
          title="Drag to reorder"
        >
          ⠿
        </button>
        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-sm" title="Project">
          📁
        </span>
        <button
          onClick={() => onOpenProject(project.id)}
          className="min-w-0 flex-1 truncate text-left text-sm text-neutral-100 hover:underline"
        >
          {project.title}
        </button>
      </div>
      <button
        onClick={() => updateProject(project.id, { status: 'active' })}
        className="ml-2 shrink-0 rounded-md bg-neutral-800 px-2 py-1 text-xs text-neutral-300 hover:bg-emerald-600 hover:text-white"
      >
        Activate
      </button>
    </div>
  )
}
