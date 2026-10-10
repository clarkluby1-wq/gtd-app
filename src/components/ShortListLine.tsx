import { useState } from 'react'
import type { Action } from '../db/types'
import { EditActionModal } from './EditActionModal'

/** One starred pick in a summary list. Click the title to open it and change anything — wording, notes, dates — before you go. */
export function ShortListLine({ action }: { action: Action }) {
  const [editing, setEditing] = useState(false)
  return (
    <li className="flex items-center gap-2 text-sm text-neutral-100">
      <span className="text-amber-400" aria-hidden>
        ★
      </span>
      <button
        onClick={() => setEditing(true)}
        title="Open to edit"
        className="min-w-0 truncate text-left hover:underline"
      >
        {action.title}
      </button>
      {editing && <EditActionModal action={action} onClose={() => setEditing(false)} />}
    </li>
  )
}
