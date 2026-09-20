import { useEffect, useState } from 'react'
import { useCompletionToast } from '../lib/completionToastContext'
import { getRemindersEnabled, REMINDERS_CHANGED } from '../lib/reminders'
import {
  DAY_NAMES,
  formatTime,
  markReviewPromptHandled,
  readPromptState,
  shouldPromptReview,
  skipReviewThisWeek,
  snoozeReviewPrompt,
} from '../lib/reviewSchedule'
import { useReviewStatus } from '../lib/useReviewStatus'

/**
 * Asks once, on the day and at the hour the user chose, whether it's time for the Weekly Review. Skipping is always
 * fine — "In an hour" and "Not this week" cost nothing. There's no server, so it can only appear while the app is
 * open; it's switched off along with the other pop-ups in Settings.
 */
export function WeeklyReviewPrompt({ onStart }: { onStart: () => void }) {
  const { blocked } = useCompletionToast()
  const { schedule, now, weekStart, loaded, doneThisWeek } = useReviewStatus()
  const [enabled, setEnabled] = useState(getRemindersEnabled)

  useEffect(() => {
    const refresh = () => setEnabled(getRemindersEnabled())
    window.addEventListener(REMINDERS_CHANGED, refresh)
    return () => window.removeEventListener(REMINDERS_CHANGED, refresh)
  }, [])

  // One demand on your attention at a time: wait for an open "what's next?" card, and stay quiet until the data is in.
  if (blocked || !enabled || !loaded || !schedule) return null
  if (!shouldPromptReview(schedule, now, doneThisWeek, readPromptState(weekStart))) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Weekly Review"
      className="fixed inset-0 z-[56] flex items-center justify-center bg-black/60 p-4"
    >
      <div className="w-full max-w-sm rounded-xl border border-neutral-800 bg-neutral-900 p-5 text-neutral-100 shadow-xl">
        <div className="mb-2 text-xs uppercase tracking-wide text-neutral-500">Weekly Review</div>
        <h2 className="mb-1 text-lg font-medium">Time for your Weekly Review</h2>
        <p className="mb-5 text-sm text-neutral-400">
          It's {DAY_NAMES[schedule.day]} at {formatTime(schedule.time)} — the slot you set aside for it.
        </p>

        <div className="flex flex-col gap-2">
          <button
            autoFocus
            onClick={() => {
              markReviewPromptHandled(now)
              onStart()
            }}
            className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Start my review
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => snoozeReviewPrompt(new Date())}
              className="flex-1 rounded-md bg-neutral-800 px-3 py-2 text-sm font-medium text-neutral-200 hover:bg-neutral-700"
            >
              In an hour
            </button>
            <button
              onClick={() => skipReviewThisWeek(new Date())}
              className="flex-1 rounded-md bg-neutral-800 px-3 py-2 text-sm font-medium text-neutral-200 hover:bg-neutral-700"
            >
              Not this week
            </button>
          </div>
        </div>
        <p className="mt-3 text-xs text-neutral-600">"Not this week" just skips this one. It comes back next week.</p>
      </div>
    </div>
  )
}
