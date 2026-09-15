import { PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'

/**
 * Drag-to-reorder for any list of items with an `id` and a numeric `order`.
 * Only the dragged item's order is written, set to the midpoint between its
 * new neighbors (or +/-1000 past either end) — so this is correct even when
 * `items` is a filtered subset of a larger list.
 */
export function useDragReorder<T extends { id: string; order: number }>(
  items: T[],
  onReorder: (id: string, order: number) => void,
) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = items.findIndex((i) => i.id === active.id)
    const newIndex = items.findIndex((i) => i.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(items, oldIndex, newIndex)
    const draggedIndex = reordered.findIndex((i) => i.id === active.id)
    const prev = reordered[draggedIndex - 1]
    const next = reordered[draggedIndex + 1]

    let newOrder: number
    if (prev && next) newOrder = (prev.order + next.order) / 2
    else if (prev) newOrder = prev.order + 1000
    else if (next) newOrder = next.order - 1000
    else newOrder = Date.now()

    onReorder(active.id as string, newOrder)
  }

  return { sensors, handleDragEnd }
}
