import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { db } from '../db/db'
import { acknowledgeReminders } from '../db/operations'
import { useCompletionToast } from '../lib/completionToastContext'
import { formatTimeOfDay, hasTimeOfDay, startOfToday } from '../lib/date'
import { dueReminders, getRemindersEnabled, REMINDERS_CHANGED } from '../lib/reminders'
import { useSomedayProjectIds } from '../lib/useSomedayProjectIds'
import type { Action } from '../db/types'

/**
 * A heads-up window for calendar items due tomorrow (and, on the day, ones you asked to be reminded about — or
 * that slipped through because the app wasn't open yesterday), plus an exact-time pop-up for anything with a
 * real time of day, not just a day. There's no server, so this can only appear while the app is open; it
 * re-checks every minute the tab stays open, and also when you return to it or midnight rolls over.
 */
export function ReminderPrompt() {
  const { blocked } = useCompletionToast()
  const scheduled = useLiveQuery(() => db.actions.where('status').equals('scheduled').toArray())
  const somedayProjectIds = useSomedayProjectIds()
  const [todayStart, setTodayStart] = useState(startOfToday)
  const [enabled, setEnabled] = useState(getRemindersEnabled)
  // Ticks every minute (and on focus/visibility/day-change) so the exact-time check below keeps re-evaluating
  // against the real clock even while the tab just sits open with nothing else changing.
  const [nowTick, setNowTick] = useState(() => Date.now())

  useEffect(() => {
    const refresh = () => {
      const today = startOfToday()
      setTodayStart((prev) => (prev === today ? prev : today))
      setEnabled(getRemindersEnabled())
      setNowTick(Date.now())
    }
    const interval = setInterval(refresh, 60_000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener(REMINDERS_CHANGED, refresh)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener(REMINDERS_CHANGED, refresh)
    }
  }, [])

  const due = useMemo(
    () => (enabled && scheduled ? dueReminders(scheduled, somedayProjectIds, todayStart, nowTick) : []),
    [enabled, scheduled, somedayProjectIds, todayStart, nowTick],
  )

  // Wait for an open "what's next?" card to be answered first — one demand on your attention at a time.
  if (blocked || due.length === 0) return null

  const now = due.filter((d) => d.kind === 'now').map((d) => d.action)
  const today = due.filter((d) => d.kind === 'today').map((d) => d.action)
  const tomorrow = due.filter((d) => d.kind === 'tomorrow').map((d) => d.action)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Coming up"
      className="fixed inset-0 z-[57] flex items-center justify-center bg-black/60 p-4"
    >
      <div className="w-full max-w-sm rounded-xl border border-neutral-800 bg-neutral-900 p-5 text-neutral-100 shadow-xl">
        <div className="mb-3 text-xs uppercase tracking-wide text-neutral-500">Coming up</div>

        {now.length > 0 && <Section title="Right now" items={now} tone="amber" />}
        {today.length > 0 && <Section title="Today" items={today} />}
        {tomorrow.length > 0 && <Section title="Tomorrow" items={tomorrow} />}

        <div className="mt-5 flex gap-2">
          <button
            autoFocus
            onClick={() => void acknowledgeReminders(due, false)}
            className="flex-1 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Got it
          </button>
          {tomorrow.length > 0 && (
            <button
              onClick={() => void acknowledgeReminders(due, true)}
              className="flex-1 rounded-md bg-neutral-800 px-3 py-2 text-sm font-medium text-neutral-200 hover:bg-neutral-700"
            >
              Remind me the day of
            </button>
          )}
        </div>
        {tomorrow.length > 0 && (
          <p className="mt-2 text-xs text-neutral-600">
            "Remind me the day of" shows this again the first time you open the app that day.
          </p>
        )}
      </div>
    </div>
  )
}

function Section({ title, items, tone }: { title: string; items: Action[]; tone?: 'amber' }) {
  return (
    <div className="mb-2">
      <div className={`mb-1 text-sm font-medium ${tone === 'amber' ? 'text-amber-400' : 'text-neutral-300'}`}>{title}</div>
      <ul className="flex flex-col gap-1">
        {items.map((a) => (
          <li
            key={a.id}
            className={`rounded-md px-3 py-2 text-sm ${
              tone === 'amber' ? 'border border-amber-500/40 bg-amber-500/10 text-neutral-100' : 'bg-neutral-800 text-neutral-100'
            }`}
          >
            {a.title}
            {a.scheduledDate !== undefined && hasTimeOfDay(a.scheduledDate) && (
              <span className="ml-1.5 text-amber-400">· {formatTimeOfDay(a.scheduledDate)}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
