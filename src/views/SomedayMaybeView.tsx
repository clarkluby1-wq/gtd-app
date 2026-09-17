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

export function SomedayMaybeView({ onOpenProject }: { onOpenProject: (id: string) => void }) {
  const [clarifying, setClarifying] = useState<Action | null>(null)
  const actions = useLiveQuery(() => db.actions.where('status').equals('someday').sortBy('order'))
  const somedayProjectsRaw = useLiveQuery(() => db.projects.where('status').equals('someday').toArray())
  const somedayProjects = useMemo(
    (): OrderedProject[] =>
      (somedayProjectsRaw ?? [])
        .map((p) => ({ ...p, order: p.order ?? p.createdAt }))
        .sort((a, b) => a.order - b.order),
    [somedayProjectsRaw],
  )

  const actionReorder = useDragReorder(actions ?? [], (id, order) => {
    void updateAction(id, { order })
  })
  const projectReorder = useDragReorder(somedayProjects, (id, order) => {
    void updateProject(id, { order })
  })

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-1 text-xl font-semibold text-neutral-100">Someday / Maybe</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Not committed to right now, but not dead either. Revisit during your weekly review — activate when ready.
      </p>

      <DndContext
        sensors={actionReorder.sensors}
        collisionDetection={closestCenter}
        onDragEnd={actionReorder.handleDragEnd}
      >
        <SortableContext items={(actions ?? []).map((a) => a.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col divide-y divide-neutral-900">
            {actions?.map((a) => (
              <SortableSomedayActionRow key={a.id} action={a} onClarify={() => setClarifying(a)} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {!!somedayProjects.length && (
        <>
          <h2 className="mb-2 mt-6 text-sm font-medium text-neutral-400">Someday Projects</h2>
          <DndContext
            sensors={projectReorder.sensors}
            collisionDetection={closestCenter}
            onDragEnd={projectReorder.handleDragEnd}
          >
            <SortableContext items={somedayProjects.map((p) => p.id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col divide-y divide-neutral-900">
                {somedayProjects.map((p) => (
                  <SortableSomedayProjectRow key={p.id} project={p} onOpenProject={onOpenProject} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </>
      )}

      {actions?.length === 0 && !somedayProjects.length && (
        <div className="rounded-lg border border-dashed border-neutral-800 p-8 text-center text-sm text-neutral-500">
          Nothing parked here.
        </div>
      )}

      {clarifying && <ClarifyModal item={clarifying} onClose={() => setClarifying(null)} />}
    </div>
  )
}

function SortableSomedayActionRow({ action, onClarify }: { action: Action; onClarify: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: action.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  return (
    <div ref={setNodeRef} style={style} className="flex items-center justify-between py-2">
      <TaskRow action={action} dragHandle={{ attributes, listeners }} />
      <button
        onClick={onClarify}
        title="Reopen Clarify — decide what this becomes now that you're ready"
        className="ml-2 shrink-0 rounded-md bg-neutral-800 px-2 py-1 text-xs text-neutral-300 hover:bg-emerald-600 hover:text-white"
      >
        Activate
      </button>
    </div>
  )
}

function SortableSomedayProjectRow({
  project,
  onOpenProject,
}: {
  project: OrderedProject
  onOpenProject: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: project.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  return (
    <div ref={setNodeRef} style={style} className="group flex items-center justify-between py-2">
      <button
        {...attributes}
        {...listeners}
        style={{ touchAction: 'none' }}
        className="mr-2 shrink-0 cursor-grab text-neutral-600 opacity-0 hover:text-neutral-300 group-hover:opacity-100 active:cursor-grabbing"
        title="Drag to reorder"
      >
        ⠿
      </button>
      <button
        onClick={() => onOpenProject(project.id)}
        className="flex-1 text-left text-sm text-neutral-200 hover:underline"
      >
        {project.title}
      </button>
      <button
        onClick={() => updateProject(project.id, { status: 'active' })}
        className="ml-2 shrink-0 rounded-md bg-neutral-800 px-2 py-1 text-xs text-neutral-300 hover:bg-emerald-600 hover:text-white"
      >
        Activate
      </button>
    </div>
  )
}
