import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db/db'
import { createAction } from '../db/operations'
import { TaskRow } from '../components/TaskRow'
import { TimeField } from '../components/TimeField'
import { parseLocalDateTime, toDateInputValue } from '../lib/date'
import { useEscapeKey } from '../lib/useEscapeKey'
import { useSomedayProjectIds } from '../lib/useSomedayProjectIds'
import { useTodayPinCount } from '../lib/shortList'
import { followUpPending } from '../lib/waiting'
import type { Action } from '../db/types'

/** The day an item sits on the Calendar: a scheduled item's date, or the day you chose to check back on a Waiting For. */
const calendarDay = (a: Action) => (a.status === 'waiting' ? a.followUpDate : a.scheduledDate)

function groupByDay(actions: Action[]) {
  const groups = new Map<string, Action[]>()
  for (const a of actions) {
    const key = new Date(calendarDay(a)!).toDateString()
    groups.set(key, [...(groups.get(key) ?? []), a])
  }
  return [...groups.entries()].sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
}

/** Add something straight to a day — no Inbox stop, since the day already says what it is. */
function QuickAdd() {
  const contexts = useLiveQuery(() => db.contexts.orderBy('order').toArray())
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(() => toDateInputValue(Date.now()))
  const [time, setTime] = useState('')
  const [contextId, setContextId] = useState('')

  const close = () => {
    setOpen(false)
    setTitle('')
    setTime('')
    setContextId('')
    setDate(toDateInputValue(Date.now()))
  }
  useEscapeKey(close, open)

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mb-6 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
      >
        + Add to calendar
      </button>
    )
  }

  const canAdd = title.trim() !== '' && date !== ''

  const submit = async () => {
    if (!canAdd) return
    await createAction({
      title: title.trim(),
      status: 'scheduled',
      scheduledDate: parseLocalDateTime(date, time || undefined),
      contextId: contextId || undefined,
    })
    close()
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
      className="mb-6 flex flex-col gap-2 rounded-lg border border-neutral-800 bg-neutral-900 p-4"
    >
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What's happening?"
        className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
      />
      <div className="flex flex-wrap gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label="Day"
          className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
        />
        <TimeField value={time} onChange={setTime} />
        {contexts && contexts.length > 0 && (
          <select
            value={contextId}
            onChange={(e) => setContextId(e.target.value)}
            aria-label="Context (optional)"
            className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
          >
            <option value="">Context — optional</option>
            {contexts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="flex items-center justify-between pt-1">
        <button type="button" onClick={close} className="text-xs text-neutral-500 hover:text-neutral-300">
          Cancel
        </button>
        <button
          type="submit"
          disabled={!canAdd}
          className="rounded-md bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </form>
  )
}

export function CalendarView({ onOpenProject }: { onOpenProject: (projectId: string) => void }) {
  const scheduled = useLiveQuery(() => db.actions.where('status').equals('scheduled').sortBy('scheduledDate'))
  // A Waiting For with a check-back date you chose shows up on that day too. It stays in Waiting For as well.
  const checkBacks = useLiveQuery(() => db.actions.where('status').equals('waiting').filter(followUpPending).toArray())
  const withDue = useLiveQuery(() =>
    db.actions
      .filter((a) => a.status === 'next' && a.dueDate != null)
      .sortBy('dueDate'),
  )
  const somedayProjectIds = useSomedayProjectIds()
  const notParked = (a: Action) => !a.projectId || !somedayProjectIds.has(a.projectId)
  // A dated item is still something you can flag as mattering today.
  const pinnedTodayCount = useTodayPinCount()

  const onCalendar = [...(scheduled ?? []).filter(notParked), ...(checkBacks ?? []).filter(notParked)]
  // Scheduled but never given a day — kept visible so it can be fixed, rather than vanishing or showing "Invalid Date".
  const undated = onCalendar.filter((a) => calendarDay(a) == null)
  const groups = scheduled ? groupByDay(onCalendar.filter((a) => calendarDay(a) != null)) : []
  const dueFiltered = withDue?.filter(notParked) ?? []

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-1 text-xl font-semibold text-neutral-100">Calendar</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Hard landscape — things tied to a specific day. Keep this list short; it's not a place to dump next actions.
        Days you chose to check back on a Waiting For show up here too.
      </p>

      <QuickAdd />

      {groups.length === 0 && undated.length === 0 && (
        <div className="mb-6 rounded-lg border border-dashed border-neutral-800 p-6 text-center text-sm text-neutral-500">
          Nothing scheduled.
        </div>
      )}

      {groups.map(([day, items]) => (
        <div key={day} className="mb-4">
          <div className="mb-1 text-xs font-medium text-sky-400">
            {new Date(day).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
          </div>
          <div className="flex flex-col divide-y divide-neutral-900">
            {items.map((a) => (
              <TaskRow
                key={a.id}
                action={a}
                showProject
                showWaitingClock={a.status === 'waiting'}
                showBigThreePin
                pinnedTodayCount={pinnedTodayCount}
                onOpenProject={onOpenProject}
              />
            ))}
          </div>
        </div>
      ))}

      {undated.length > 0 && (
        <div className="mb-4">
          <div className="mb-1 text-xs font-medium text-amber-500">No date yet — open one to give it a day</div>
          <div className="flex flex-col divide-y divide-neutral-900">
            {undated.map((a) => (
              <TaskRow key={a.id} action={a} showProject onOpenProject={onOpenProject} />
            ))}
          </div>
        </div>
      )}

      {!!dueFiltered.length && (
        <>
          <h2 className="mb-2 mt-6 text-sm font-medium text-amber-500">Upcoming Deadlines</h2>
          <div className="flex flex-col divide-y divide-neutral-900">
            {dueFiltered.map((a) => (
              <TaskRow key={a.id} action={a} showProject showBigThreePin pinnedTodayCount={pinnedTodayCount} onOpenProject={onOpenProject} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
