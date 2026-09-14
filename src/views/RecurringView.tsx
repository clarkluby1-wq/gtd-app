import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db/db'
import { createRecurringTemplate, deleteRecurringTemplate, updateRecurringTemplate } from '../db/recurring'
import type { RecurrenceFrequency, RecurringTemplate } from '../db/types'

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function RecurringView() {
  const templates = useLiveQuery(() => db.recurringTemplates.orderBy('createdAt').toArray())
  const contexts = useLiveQuery(() => db.contexts.orderBy('order').toArray())

  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('weekly')
  const [interval, setInterval] = useState(1)
  const [weekdays, setWeekdays] = useState<number[]>([1])
  const [dayOfMonth, setDayOfMonth] = useState(1)
  const [contextId, setContextId] = useState<string | undefined>()

  const create = async () => {
    if (!title.trim()) return
    await createRecurringTemplate({
      title: title.trim(),
      contextId,
      recurrence: {
        frequency,
        interval,
        weekdays: frequency === 'weekly' ? weekdays : undefined,
        dayOfMonth: frequency === 'monthly' ? dayOfMonth : undefined,
      },
    })
    setTitle('')
    setCreating(false)
  }

  const describe = (t: RecurringTemplate) => {
    const r = t.recurrence
    if (r.frequency === 'daily') return r.interval === 1 ? 'Every day' : `Every ${r.interval} days`
    if (r.frequency === 'weekly') {
      const days = r.weekdays?.map((d) => WEEKDAY_LABELS[d]).join(', ') ?? ''
      return r.interval === 1 ? `Every week on ${days}` : `Every ${r.interval} weeks on ${days}`
    }
    return r.interval === 1
      ? `Every month on day ${r.dayOfMonth}`
      : `Every ${r.interval} months on day ${r.dayOfMonth}`
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-100">Recurring</h1>
        <button
          onClick={() => setCreating((v) => !v)}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
        >
          + New Recurring Item
        </button>
      </div>
      <p className="mb-6 text-sm text-neutral-500">
        Calendar-anchored commitments that repeat. Each occurrence appears on the Calendar on its due day.
      </p>

      {creating && (
        <div className="mb-6 flex flex-col gap-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What repeats?"
            className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
          />

          <div className="flex gap-2">
            {(['daily', 'weekly', 'monthly'] as RecurrenceFrequency[]).map((f) => (
              <button
                key={f}
                onClick={() => setFrequency(f)}
                className={`flex-1 rounded-md px-3 py-2 text-xs font-medium ${
                  frequency === f ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-300'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-sm text-neutral-300">
            <span>Every</span>
            <input
              type="number"
              min={1}
              value={interval}
              onChange={(e) => setInterval(Math.max(1, Number(e.target.value)))}
              className="w-16 rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm outline-none"
            />
            <span>{frequency === 'daily' ? 'day(s)' : frequency === 'weekly' ? 'week(s), on' : 'month(s), on day'}</span>
          </div>

          {frequency === 'weekly' && (
            <div className="flex gap-1">
              {WEEKDAY_LABELS.map((label, i) => (
                <button
                  key={label}
                  onClick={() =>
                    setWeekdays((prev) => (prev.includes(i) ? prev.filter((d) => d !== i) : [...prev, i]))
                  }
                  className={`flex-1 rounded-md px-2 py-1 text-xs ${
                    weekdays.includes(i) ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {frequency === 'monthly' && (
            <input
              type="number"
              min={1}
              max={31}
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(Math.min(31, Math.max(1, Number(e.target.value))))}
              className="w-20 rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm outline-none"
            />
          )}

          <select
            value={contextId ?? ''}
            onChange={(e) => setContextId(e.target.value || undefined)}
            className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
          >
            <option value="">No context</option>
            {contexts?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <button
            onClick={create}
            disabled={!title.trim() || (frequency === 'weekly' && weekdays.length === 0)}
            className="self-start rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
          >
            Save
          </button>
        </div>
      )}

      {templates?.length === 0 && !creating && (
        <div className="rounded-lg border border-dashed border-neutral-800 p-8 text-center text-sm text-neutral-500">
          Nothing recurring yet.
        </div>
      )}

      <div className="flex flex-col gap-2">
        {templates?.map((t) => (
          <div key={t.id} className="group flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900 p-4">
            <div>
              <div className={`text-sm font-medium ${t.active ? 'text-neutral-100' : 'text-neutral-500 line-through'}`}>
                {t.title}
              </div>
              <div className="text-xs text-neutral-500">{describe(t)}</div>
            </div>
            <div className="flex gap-2 opacity-0 group-hover:opacity-100">
              <button
                onClick={() => updateRecurringTemplate(t.id, { active: !t.active })}
                className="text-xs text-neutral-400 hover:text-emerald-400"
              >
                {t.active ? 'Pause' : 'Resume'}
              </button>
              <button onClick={() => deleteRecurringTemplate(t.id)} className="text-xs text-neutral-600 hover:text-red-400">
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
