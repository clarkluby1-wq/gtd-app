import { useState } from 'react'
import { startOfToday } from '../lib/date'

const CALENDARS = [
  { key: 'work', label: 'Work calendar' },
  { key: 'personal', label: 'Personal calendar' },
  { key: 'other', label: 'Other calendar (a side business, family…)' },
]

const CHECKED_KEY = 'gtd.startDay.calendarsChecked'
const HIDDEN_KEY = 'gtd.startDay.hiddenCalendars'

/** Which calendars you've looked at today. It starts fresh every morning. */
function loadChecked(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(CHECKED_KEY) ?? 'null')
    if (raw && raw.day === startOfToday() && Array.isArray(raw.keys)) {
      return new Set(raw.keys.filter((k: unknown): k is string => typeof k === 'string'))
    }
  } catch {
    // Start fresh.
  }
  return new Set()
}

function saveChecked(keys: Set<string>) {
  try {
    localStorage.setItem(CHECKED_KEY, JSON.stringify({ day: startOfToday(), keys: [...keys] }))
  } catch {
    // The ticks just won't be remembered.
  }
}

/** Calendars you said you don't have. They stay off the list for good. */
function loadHidden(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]')
    return new Set(Array.isArray(raw) ? raw.filter((k): k is string => typeof k === 'string') : [])
  } catch {
    return new Set()
  }
}

function saveHidden(keys: Set<string>) {
  try {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify([...keys]))
  } catch {
    // They'll just reappear next time.
  }
}

/**
 * The part of the morning that lives outside this app: look at your calendars, and ask what you've committed to.
 * A prompt, not a requirement — nothing here blocks the next step, and nothing is stored beyond today's ticks.
 */
export function CommitmentsStep() {
  const [checked, setChecked] = useState(loadChecked)
  const [hidden, setHidden] = useState(loadHidden)

  const shown = CALENDARS.filter((c) => !hidden.has(c.key))
  const allChecked = shown.length > 0 && shown.every((c) => checked.has(c.key))

  const toggle = (key: string) => {
    const next = new Set(checked)
    if (!next.delete(key)) next.add(key)
    saveChecked(next)
    setChecked(next)
  }
  const hide = (key: string) => {
    const next = new Set(hidden).add(key)
    saveHidden(next)
    setHidden(next)
  }
  const restore = () => {
    saveHidden(new Set())
    setHidden(new Set())
  }

  return (
    <div>
      <p className="mb-4 text-sm text-neutral-400">
        Open your calendars and take a look at today. Tick each one as you go — or don't; it's only a nudge.
      </p>

      <div className="mb-5 flex flex-col gap-2.5 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        {shown.map((c) => (
          <div key={c.key} className="flex items-center justify-between gap-3">
            <label className="flex cursor-pointer items-center gap-3 text-sm text-neutral-200">
              <input
                type="checkbox"
                checked={checked.has(c.key)}
                onChange={() => toggle(c.key)}
                className="h-4 w-4 accent-emerald-600"
              />
              <span className={checked.has(c.key) ? 'text-neutral-500 line-through' : ''}>{c.label}</span>
            </label>
            <button
              onClick={() => hide(c.key)}
              title="Leave this off my list for good"
              className="shrink-0 text-xs text-neutral-600 hover:text-neutral-300"
            >
              don't have this
            </button>
          </div>
        ))}
        {shown.length === 0 && <p className="text-sm text-neutral-500">No calendars on your list.</p>}
        {allChecked && <p className="pt-1 text-xs text-emerald-400">✓ You know the shape of your day.</p>}
        {hidden.size > 0 && (
          <button onClick={restore} className="self-start pt-1 text-xs text-neutral-500 hover:text-neutral-300">
            Show the {hidden.size} I left off
          </button>
        )}
      </div>

      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">As you look, ask yourself</h3>
      <ul className="mb-5 flex flex-col gap-1.5 text-sm text-neutral-300">
        <li>What has a time attached to it today?</li>
        <li>Is there anything to prepare, or travel time to allow for?</li>
        <li>Is anyone counting on me today?</li>
      </ul>

      <p className="text-xs text-neutral-500">
        Spotted something you need to do or get ready for? Drop it in the capture bar at the top — it goes straight to
        your Inbox.
      </p>
    </div>
  )
}
