import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { db } from '../db/db'
import { addActionToProject } from '../db/operations'
import { parseLocalDateTime } from '../lib/date'
import { suggestContextId } from '../lib/suggestContext'
import { useWaitingOnNames } from '../lib/waiting'
import type { Project } from '../db/types'
import { TimeField } from './TimeField'

type StepType = 'next' | 'waiting' | 'scheduled'

const TYPES: { key: StepType; label: string }[] = [
  { key: 'next', label: 'Next Action' },
  { key: 'waiting', label: 'Waiting For' },
  { key: 'scheduled', label: 'Scheduled' },
]

const field = 'rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm outline-none'

/**
 * Add a project's next step. Quick by default — just the wording — with an optional "details" panel for what kind
 * of step it is (Next Action, Waiting For, Scheduled) and its context, who it's waiting on, or its day and time.
 */
export function NextStepForm({ project, onAdded }: { project: Project; onAdded: (title: string) => void }) {
  const contexts = useLiveQuery(() => db.contexts.orderBy('order').toArray())
  const history = useLiveQuery(() => db.actions.filter((a) => !!a.contextId && a.status !== 'trash').toArray())
  const waitingOnNames = useWaitingOnNames()

  const [text, setText] = useState('')
  const [more, setMore] = useState(false)
  const [type, setType] = useState<StepType>('next')
  const [contextId, setContextId] = useState('')
  const [waitingOn, setWaitingOn] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')

  // The same quiet guess as in Clarify: listed first in the picker, never chosen for you.
  const suggested = useMemo(() => {
    if (!more || type === 'waiting') return undefined
    const id = suggestContextId(text, contexts ?? [], history ?? [])
    return contexts?.find((c) => c.id === id)
  }, [more, type, text, contexts, history])

  const missing =
    type === 'waiting' && !waitingOn.trim() ? 'Who is it waiting on?' : type === 'scheduled' && !date ? 'Which day?' : undefined
  const canAdd = text.trim() !== '' && (!more || !missing)

  const add = async () => {
    const title = text.trim()
    if (!title || (more && missing)) return
    const kind: StepType = more ? type : 'next'
    await addActionToProject(project.id, title, {
      status: kind,
      contextId: more && kind !== 'waiting' ? contextId || undefined : undefined,
      waitingOn: more && kind === 'waiting' ? waitingOn.trim() : undefined,
      scheduledDate: more && kind === 'scheduled' ? parseLocalDateTime(date, time || undefined) : undefined,
    })
    setText('')
    onAdded(title)
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void add()
      }}
    >
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What's the very next step?"
          className={`${field} flex-1`}
        />
        <button
          type="submit"
          disabled={!canAdd}
          title={more && missing ? missing : undefined}
          className="rounded-md bg-neutral-800 px-3 py-1.5 text-xs text-neutral-200 hover:bg-emerald-600 hover:text-white disabled:opacity-40"
        >
          Add
        </button>
      </div>

      <button
        type="button"
        onClick={() => setMore((v) => !v)}
        aria-expanded={more}
        className="mt-1.5 text-xs text-neutral-400 hover:text-neutral-200"
      >
        {more ? '▾ Fewer details' : '▸ Add details — context, waiting for, date'}
      </button>

      {more && (
        <div className="mt-2 flex flex-col gap-2 rounded-md border border-neutral-800 bg-neutral-950 p-3">
          <div className="flex gap-1">
            {TYPES.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setType(t.key)}
                className={`flex-1 rounded-md px-2 py-1 text-xs font-medium ${
                  type === t.key ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {type !== 'waiting' && (
            <select
              value={contextId}
              onChange={(e) => setContextId(e.target.value)}
              aria-label="Context"
              className={field}
            >
              {suggested && <option value={suggested.id}>{suggested.name} — suggested</option>}
              <option value="">No context</option>
              {contexts
                ?.filter((c) => c.id !== suggested?.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          )}

          {type === 'waiting' && (
            <>
              <input
                value={waitingOn}
                onChange={(e) => setWaitingOn(e.target.value)}
                list={`next-step-waiting-on-${project.id}`}
                placeholder="Waiting on whom?"
                className={field}
              />
              <datalist id={`next-step-waiting-on-${project.id}`}>
                {waitingOnNames.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </>
          )}

          {type === 'scheduled' && (
            <div className="flex flex-wrap gap-2">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                aria-label="Day"
                className={field}
              />
              <TimeField value={time} onChange={setTime} />
            </div>
          )}

          {missing && <p className="text-xs text-amber-400/90">{missing}</p>}
        </div>
      )}
    </form>
  )
}
