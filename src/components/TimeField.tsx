import { useEffect, useState } from 'react'
import { formatTimeOfDay, parseTypedTime } from '../lib/date'

const display = (value: string) => {
  if (!value) return ''
  const [h, m] = value.split(':').map(Number)
  return formatTimeOfDay(new Date(2000, 0, 1, h, m).getTime())
}

/**
 * A time you type — "7pm", "1130a", "noon" — instead of picking from a clock. Works in the same "HH:MM" string the
 * native time input used, so callers don't change. What it understood is shown beside it, so a wrong guess is obvious.
 */
export function TimeField({
  value,
  onChange,
  className = '',
}: {
  /** "HH:MM", or '' for no time. */
  value: string
  onChange: (value: string) => void
  className?: string
}) {
  const [text, setText] = useState(() => display(value))

  // The parent cleared or replaced the time (e.g. after adding an item): follow it, unless it's just our own echo.
  useEffect(() => {
    if ((parseTypedTime(text) ?? '') !== value) setText(display(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const parsed = text.trim() ? parseTypedTime(text) : ''
  const unreadable = parsed === null

  return (
    <div className="flex flex-col gap-0.5">
      <input
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          onChange(parseTypedTime(e.target.value) ?? '')
        }}
        // Tidy up on leaving: a readable time becomes "7:00 pm"; an unreadable one reverts rather than being lost silently.
        onBlur={() => setText(display(unreadable ? value : (parsed as string)))}
        placeholder="Time — e.g. 7pm"
        aria-label="Time — optional, only if it truly has to happen then"
        className={`w-32 rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none ${className}`}
      />
      {/* Always takes its line, so tidying the text on blur can't shift the buttons below and swallow a click. */}
      <span className={`min-h-4 text-xs ${unreadable ? 'text-amber-500' : 'text-neutral-500'}`}>
        {unreadable
          ? 'Try 7pm, 1130a or 19:30'
          : parsed && text.trim() !== display(parsed)
            ? `→ ${display(parsed)}`
            : ' '}
      </span>
    </div>
  )
}
