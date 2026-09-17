import { closestCenter, DndContext } from '@dnd-kit/core'
import type { DraggableAttributes } from '@dnd-kit/core'
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db/db'
import { ClarifyModal } from '../components/ClarifyModal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { deleteAction, updateAction } from '../db/operations'
import { useDragReorder } from '../lib/useDragReorder'
import type { Action } from '../db/types'

export function InboxView() {
  const items = useLiveQuery(() => db.actions.where('status').equals('inbox').sortBy('order'))
  const [clarifying, setClarifying] = useState<Action | null>(null)

  const { sensors, handleDragEnd } = useDragReorder(items ?? [], (id, order) => {
    void updateAction(id, { order })
  })

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-1 text-xl font-semibold text-neutral-100">Inbox</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Capture everything here first. Then process each item, one at a time, from the top — decide what it is and
        what to do with it before moving to the next.
      </p>

      {items?.length === 0 && (
        <div className="rounded-lg border border-dashed border-neutral-800 p-8 text-center text-sm text-neutral-500">
          Inbox zero. Nice.
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={(items ?? []).map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col divide-y divide-neutral-900">
            {items?.map((item) => (
              <SortableInboxRow key={item.id} item={item} onClarify={() => setClarifying(item)} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {clarifying && <ClarifyModal item={clarifying} onClose={() => setClarifying(null)} />}
    </div>
  )
}

function SortableInboxRow({ item, onClarify }: { item: Action; onClarify: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  return (
    <div ref={setNodeRef} style={style}>
      <InboxRow item={item} onClarify={onClarify} dragHandle={{ attributes, listeners }} />
    </div>
  )
}

function InboxRow({
  item,
  onClarify,
  dragHandle,
}: {
  item: Action
  onClarify: () => void
  dragHandle: { attributes: DraggableAttributes; listeners: SyntheticListenerMap | undefined }
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item.title)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const save = () => {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed && trimmed !== item.title) {
      updateAction(item.id, { title: trimmed })
    } else {
      setDraft(item.title)
    }
  }

  return (
    <div className="group flex items-center justify-between gap-3 py-3">
      <button
        {...dragHandle.attributes}
        {...dragHandle.listeners}
        style={{ touchAction: 'none' }}
        className="shrink-0 cursor-grab text-neutral-600 opacity-0 hover:text-neutral-300 group-hover:opacity-100 active:cursor-grabbing"
        title="Drag to reorder"
      >
        ⠿
      </button>

      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save()
            if (e.key === 'Escape') {
              setDraft(item.title)
              setEditing(false)
            }
          }}
          className="flex-1 rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm text-neutral-100 outline-none"
        />
      ) : (
        <span
          onClick={() => setEditing(true)}
          className="flex-1 cursor-pointer text-sm text-neutral-100 hover:underline"
        >
          {item.title}
        </span>
      )}

      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={onClarify}
          className="rounded-md bg-neutral-800 px-3 py-1 text-xs font-medium text-neutral-200 hover:bg-emerald-600 hover:text-white"
        >
          Clarify →
        </button>
        <button
          onClick={() => setConfirmingDelete(true)}
          className="text-neutral-600 opacity-0 hover:text-red-400 group-hover:opacity-100"
          title="Delete"
        >
          ✕
        </button>
      </div>

      {confirmingDelete && (
        <ConfirmDialog
          message={`Delete "${item.title}"? This can't be undone.`}
          onConfirm={() => {
            deleteAction(item.id)
            setConfirmingDelete(false)
          }}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  )
}
