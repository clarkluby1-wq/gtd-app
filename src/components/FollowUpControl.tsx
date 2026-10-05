import { logFollowUp, snoozeWaiting, undoLastFollowUp } from '../db/operations'
import { formatShortDate } from '../lib/date'
import { showUndo } from '../lib/undoSnack'
import { isSnoozed, SNOOZE_CHOICES, snoozeWakeTime, wasFollowedUpToday, type SnoozeChoice } from '../lib/waiting'
import type { Action } from '../db/types'

/**
 * What you can do about a Waiting For that's gone quiet. "Followed up" records that you did chase (a day-level fact,
 * with an undo). "Snooze" is the other honest answer: you're still waiting, but choosing not to pester for now —
 * it stays on Waiting For and simply leaves the nudges until the time you pick.
 */
export function FollowUpControl({ action, onLogged }: { action: Action; onLogged: () => void }) {
  if (isSnoozed(action)) {
    return (
      <span className="flex shrink-0 items-center gap-2 text-xs text-neutral-400">
        Snoozed until {formatShortDate(action.snoozedUntil!)}
        <button onClick={() => void snoozeWaiting(action.id, undefined)} className="text-neutral-500 hover:text-neutral-300">
          wake up
        </button>
      </span>
    )
  }

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

  const snooze = (choice: SnoozeChoice) => {
    const before = action.snoozedUntil
    const until = snoozeWakeTime(choice)
    void snoozeWaiting(action.id, until)
    showUndo(`Snoozed “${action.title}” until ${formatShortDate(until)}`, () => void snoozeWaiting(action.id, before))
  }

  return (
    <span className="flex shrink-0 items-center gap-2">
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
      <select
        value=""
        onChange={(e) => e.target.value && snooze(e.target.value as SnoozeChoice)}
        aria-label="Snooze — still waiting, but not chasing for now"
        title="Still waiting, but not chasing for now. It stays on Waiting For and comes back when the time is up."
        className="shrink-0 rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
      >
        <option value="">Snooze…</option>
        {SNOOZE_CHOICES.map((c) => (
          <option key={c.key} value={c.key}>
            {c.label}
          </option>
        ))}
      </select>
    </span>
  )
}
