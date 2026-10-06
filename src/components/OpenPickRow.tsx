import { useState } from 'react'
import { completeAction } from '../db/operations'
import { celebrateCompletion } from '../lib/celebrateCompletion'
import { useCompletionToast } from '../lib/completionToastContext'
import type { Action } from '../db/types'
import { EditActionModal } from './EditActionModal'

/**
 * A leftover Short List pick, shown when you're deciding what carries forward. You can tick it done right here (you
 * may already have finished it), open it to edit by clicking the title, or take the row's main action ("Pull into
 * today", "Carry into tomorrow").
 */
export function OpenPickRow({
  action,
  actionLabel,
  onAction,
  disabled,
  actionTitle,
}: {
  action: Action
  actionLabel: string
  onAction: () => void
  disabled?: boolean
  actionTitle?: string
}) {
  const [editing, setEditing] = useState(false)
  const { notify } = useCompletionToast()

  return (
    <div className="flex items-center gap-3 py-2">
      <button
        onClick={() => setEditing(true)}
        title="Open to edit"
        className="min-w-0 flex-1 truncate text-left text-sm text-neutral-300 hover:text-neutral-100 hover:underline"
      >
        {action.title}
      </button>
      <button
        onClick={(e) => {
          void completeAction(action.id)
          notify(action)
          void celebrateCompletion(action, e.currentTarget)
        }}
        title="Already finished — mark it done"
        className="shrink-0 rounded-md border border-emerald-800 px-2.5 py-1 text-xs font-medium text-emerald-400 hover:bg-emerald-600 hover:text-white"
      >
        ✓ Done
      </button>
      <button
        onClick={onAction}
        disabled={disabled}
        title={actionTitle}
        className="shrink-0 text-xs text-emerald-400 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-30"
      >
        {actionLabel}
      </button>
      {editing && <EditActionModal action={action} onClose={() => setEditing(false)} />}
    </div>
  )
}
