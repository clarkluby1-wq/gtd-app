import { logFollowUp, undoLastFollowUp } from '../db/operations'
import { wasFollowedUpToday } from '../lib/waiting'
import type { Action } from '../db/types'

/** One click records that you followed up. It's a day-level fact, so once it's logged today it shows as done, with an undo for mistakes. */
export function FollowUpControl({ action, onLogged }: { action: Action; onLogged: () => void }) {
  if (wasFollowedUpToday(action)) {
    return (
      <span className="flex shrink-0 items-center gap-2 text-xs text-emerald-400">
        ✓ Followed up today
        <button onClick={() => undoLastFollowUp(action.id)} className="text-neutral-500 hover:text-neutral-300">
          undo
        </button>
      </span>
    )
  }
  return (
    <button
      onClick={() => {
        void logFollowUp(action.id)
        onLogged()
      }}
      title="Log that you followed up — a reminder, a nudge, a call"
      className="shrink-0 rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:bg-emerald-600 hover:text-white"
    >
      Followed up
    </button>
  )
}
