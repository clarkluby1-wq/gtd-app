import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState } from 'react'
import { db } from '../db/db'
import { captureAsNextAction, captureToInbox, deleteAction } from '../db/operations'
import { SHORT_LIST_MAX, useTodayPinCount } from '../lib/shortList'
import { showUndo } from '../lib/undoSnack'
import type { Context } from '../db/types'

interface Parsed {
  /** What's left once the recognised words are taken out. */
  title: string
  priority: boolean
  context?: Context
  /** Where the "p1" sat in the words, so the ☆ can take just that back out. */
  priorityAt?: number
  words: string[]
}

/**
 * Quick-capture shorthand. "p1" (priority) and one of your own contexts ("@errands") are recognised only as separate
 * words at the very start or end of the note, in any order, e.g. "Pick up milk @errands p1". Anywhere else they're
 * just wording, so "fill out form P1" or "email john@gmail.com" are left alone. A context has to match one you have.
 */
function parseCapture(raw: string, contexts: Context[]): Parsed {
  const words = raw.trim().split(/\s+/).filter(Boolean)
  let priorityAt: number | undefined
  let context: Context | undefined
  const take = (i: number) => {
    const w = words[i].toLowerCase()
    if (w === 'p1' && priorityAt === undefined) {
      priorityAt = i
      return true
    }
    if (!context && w.startsWith('@')) {
      const found = contexts.find((c) => {
        const name = c.name.toLowerCase()
        return name === w || `@${name}` === w
      })
      if (found) {
        context = found
        return true
      }
    }
    return false
  }

  let lo = 0
  let hi = words.length - 1
  while (hi > lo && take(hi)) hi--
  while (hi > lo && take(lo)) lo++
  return { title: words.slice(lo, hi + 1).join(' '), priority: priorityAt !== undefined, context, priorityAt, words }
}

export function CaptureBar() {
  const [value, setValue] = useState('')
  const [starNext, setStarNext] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const pinCount = useTodayPinCount()
  const contexts = useLiveQuery(() => db.contexts.orderBy('order').toArray()) ?? []

  const parsed = parseCapture(value, contexts)
  const priority = starNext || parsed.priority
  const recognised = priority || parsed.context !== undefined

  // The "@…" word being typed right now (at the end), for the tap-to-insert suggestions.
  const partial = value.match(/(?:^|\s)(@\w*)$/)?.[1]
  const suggestions =
    partial !== undefined && !parsed.context
      ? contexts.filter((c) => c.name.toLowerCase().startsWith(partial.toLowerCase()) && c.name.toLowerCase() !== partial.toLowerCase())
      : []

  const submit = () => {
    const { title, context } = parsed
    if (!title) return
    const asPriority = priority
    setValue('')
    setStarNext(false)
    inputRef.current?.focus()

    if (!asPriority && !context) {
      void captureToInbox(title)
      return
    }
    // A priority or a context means you've already decided: it skips the Inbox and goes straight to Next Actions.
    // It only gets the star if today's Short List has room; either way it isn't lost.
    const room = (pinCount ?? 0) < SHORT_LIST_MAX
    const star = asPriority && room
    const where = context ? ` · ${context.name}` : ''
    void captureAsNextAction(title, { star, contextId: context?.id }).then((action) =>
      showUndo(
        star
          ? `★ Added to your Short List${where}: “${title}”`
          : asPriority
            ? `Short List is full — added to Next Actions${where}: “${title}”`
            : `Added to Next Actions${where}: “${title}”`,
        () => void deleteAction(action.id),
      ),
    )
  }

  const insertContext = (c: Context) => {
    setValue(value.replace(/(^|\s)@\w*$/, (_m, lead: string) => `${lead}${c.name} `))
    inputRef.current?.focus()
  }

  const hint = ['Next Action', parsed.context?.name, priority ? '★ Short List' : undefined].filter(Boolean).join(' · ')

  return (
    <div className="relative z-[58] border-b border-neutral-800 bg-neutral-900">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
        // Capture is never blocked: it sits above every window (Clarify, Edit, Mind Sweep, reminders, the "what's next?"
        // card and its shield), so a thought can always be caught the moment it shows up.
        className="flex items-center gap-2 px-4 py-3"
      >
        <span className="text-neutral-500">+</span>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            }
          }}
          placeholder="Capture anything on your mind… (Enter to add to Inbox)"
          className="flex-1 bg-transparent text-sm text-neutral-100 placeholder-neutral-500 outline-none"
        />
        <button
          type="button"
          onClick={() => {
            // A typed "p1" is taken back out of the wording (anything else you typed stays); otherwise this just
            // switches the star on or off.
            if (parsed.priorityAt !== undefined) setValue(parsed.words.filter((_, i) => i !== parsed.priorityAt).join(' '))
            else setStarNext((v) => !v)
          }}
          aria-pressed={priority}
          aria-label="Priority"
          title={
            priority
              ? "Priority — goes straight onto today's Short List (tap to turn off)"
              : 'Priority — tap, or end the note with "p1", to put it straight on today\'s Short List instead of the Inbox'
          }
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base transition ${
            priority ? 'bg-amber-400/20 text-amber-400' : 'text-neutral-600 hover:bg-neutral-800 hover:text-amber-400'
          }`}
        >
          {priority ? '★' : '☆'}
        </button>
        <button
          type="submit"
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
        >
          Capture
        </button>
      </form>

      {/* Floats under the bar, so showing it never pushes the screen down. */}
      {(suggestions.length > 0 || (recognised && parsed.title)) && (
        <div className="absolute left-0 right-0 top-full z-10 flex flex-wrap items-center gap-2 border-b border-neutral-800 bg-neutral-900 px-4 pb-2.5 pt-0.5 text-xs">
          {suggestions.length > 0 ? (
            <>
              <span className="text-neutral-500">Context:</span>
              {suggestions.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  // Keeps the cursor in the box, so tapping a suggestion doesn't dismiss the keyboard.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insertContext(c)}
                  className="rounded-full bg-neutral-800 px-3 py-1 text-neutral-200 hover:bg-emerald-600 hover:text-white"
                >
                  {c.name}
                </button>
              ))}
            </>
          ) : (
            <span className="text-emerald-400">→ {hint}</span>
          )}
        </div>
      )}
    </div>
  )
}
