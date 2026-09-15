import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { TaskRow } from './TaskRow'
import type { Action } from '../db/types'

export function SortableTaskRow({ action, showProject }: { action: Action; showProject?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: action.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <TaskRow action={action} showProject={showProject} dragHandle={{ attributes, listeners }} />
    </div>
  )
}
