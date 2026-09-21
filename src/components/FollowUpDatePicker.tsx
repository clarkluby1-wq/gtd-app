import { useState } from 'react'
import { startOfToday, toDateInputValue } from '../lib/date'

function inDays(days: number): string {
  const d = new Date(startOfToday())
  d.setDate(d.getDate() + days)
  return toDateInputValue(d.getTime())
}

/**
 * "Check back on" for a Waiting For item. Optional by design: "No date" is the default and simply means the normal
 * rhythm (a nudge after a week without contact). A date is a day you chose to look at this again — not a deadline.
 * `value` is a "YYYY-MM-DD" string, or "" for no date.
 */
export function FollowUpDatePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [picking, setPicking] = useState(false)
  const today = inDays(0)
  const tomorrow = inDays(1)
  const in3 = inDays(3)
  const in7 = inDays(7)
  const mode = !value
    ? picking
      ? 'custom'
      : 'none'
    : value === today
      ? 'today'
      : value === tomorrow
        ? 'tomorrow'
        : value === in3
          ? '3'
          : value === in7
            ? '7'
            : 'custom'

  const chip = (active: boolean, label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-xs font-medium ${
        active ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs text-neutral-500">Check back on (optional)</label>
      <div className="flex flex-wrap gap-1.5">
        {chip(mode === 'none', 'No date', () => {
          setPicking(false)
          onChange('')
        })}
        {chip(mode === 'today', 'Later today', () => {
          setPicking(false)
          onChange(today)
        })}
        {chip(mode === 'tomorrow', 'Tomorrow', () => {
          setPicking(false)
          onChange(tomorrow)
        })}
        {chip(mode === '3', '3 days', () => {
          setPicking(false)
          onChange(in3)
        })}
        {chip(mode === '7', '1 week', () => {
          setPicking(false)
          onChange(in7)
        })}
        {chip(mode === 'custom', 'Pick a date', () => setPicking(true))}
      </div>
      {mode === 'custom' && (
        <input
          type="date"
          value={value}
          min={toDateInputValue(startOfToday())}
          onChange={(e) => onChange(e.target.value)}
          className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
        />
      )}
      <p className="text-xs text-neutral-600">
        {value
          ? "It'll show on your Calendar that day."
          : "With no date, you'll be nudged after a week without hearing back."}
      </p>
    </div>
  )
}
