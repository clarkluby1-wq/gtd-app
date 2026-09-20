import { useState } from 'react'
import {
  DAY_NAMES,
  describeSchedule,
  describeStatus,
  setReviewSchedule,
  type ReviewSchedule,
} from '../lib/reviewSchedule'
import { useReviewStatus } from '../lib/useReviewStatus'

// Only a starting suggestion — nothing is saved until "Set my review time" is pressed.
const SUGGESTION: ReviewSchedule = { day: 5, time: '15:00' }

/**
 * Where the user commits to a regular Weekly Review slot. The same day and hour every week is what makes it a habit,
 * so the wording leans on that; it can be changed or removed at any time.
 */
export function ReviewSchedulePanel() {
  const { schedule, now, doneThisWeek } = useReviewStatus()
  const [editing, setEditing] = useState(false)
  const [day, setDay] = useState(SUGGESTION.day)
  const [time, setTime] = useState(SUGGESTION.time)

  const showEditor = editing || !schedule

  const startEditing = () => {
    setDay(schedule?.day ?? SUGGESTION.day)
    setTime(schedule?.time ?? SUGGESTION.time)
    setEditing(true)
  }

  if (!showEditor && schedule) {
    return (
      <div className="mb-6 flex items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-neutral-100">{describeSchedule(schedule)}</div>
          <div className="text-xs text-neutral-500">{describeStatus(schedule, now, doneThisWeek)}</div>
        </div>
        <button onClick={startEditing} className="shrink-0 text-xs text-neutral-500 hover:text-neutral-300">
          Change
        </button>
      </div>
    )
  }

  return (
    <div className="mb-6 rounded-lg border border-emerald-900/50 bg-emerald-950/20 p-4">
      <div className="mb-1 text-sm font-medium text-neutral-100">
        {schedule ? 'Change your review time' : 'When will you do your Weekly Review?'}
      </div>
      <p className="mb-3 text-xs text-neutral-400">
        The review only works if it happens every week. Pick a regular slot — the same day and hour — and treat it like
        an appointment. You can change it any time.
      </p>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-neutral-300">
        <span>Every</span>
        <select
          value={day}
          onChange={(e) => setDay(Number(e.target.value))}
          className="rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-sm outline-none"
        >
          {DAY_NAMES.map((name, i) => (
            <option key={name} value={i}>
              {name}
            </option>
          ))}
        </select>
        <span>at</span>
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-sm outline-none"
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          disabled={!time}
          onClick={() => {
            setReviewSchedule({ day, time })
            setEditing(false)
          }}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
        >
          {schedule ? 'Save' : 'Set my review time'}
        </button>
        {schedule && (
          <>
            <button onClick={() => setEditing(false)} className="text-xs text-neutral-500 hover:text-neutral-300">
              Cancel
            </button>
            <button
              onClick={() => {
                setReviewSchedule(null)
                setEditing(false)
              }}
              className="ml-auto text-xs text-neutral-600 hover:text-neutral-300"
            >
              Remove my review time
            </button>
          </>
        )}
      </div>
    </div>
  )
}
