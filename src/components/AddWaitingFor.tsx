import { useState } from 'react'
import { createAction } from '../db/operations'
import { parseLocalDate } from '../lib/date'
import { useEscapeKey } from '../lib/useEscapeKey'
import { useSimilarExisting } from '../lib/useSimilarExisting'
import { useWaitingOnNames } from '../lib/waiting'
import { FollowUpDatePicker } from './FollowUpDatePicker'
import { ProjectPicker } from './ProjectPicker'
import { SimilarNotice } from './SimilarNotice'

const field = 'rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none'

/** Add a Waiting For straight from its own screen — no Inbox stop, since "waiting on someone" already says what it is. */
export function AddWaitingFor() {
  const names = useWaitingOnNames()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [waitingOn, setWaitingOn] = useState('')
  const [followUp, setFollowUp] = useState('')
  const [projectId, setProjectId] = useState<string | undefined>()
  const [moreOpen, setMoreOpen] = useState(false)

  const close = () => {
    setOpen(false)
    setTitle('')
    setWaitingOn('')
    setFollowUp('')
    setProjectId(undefined)
    setMoreOpen(false)
  }
  useEscapeKey(close, open)
  const similar = useSimilarExisting(open ? title : '')

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mb-4 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
      >
        + Add Waiting For
      </button>
    )
  }

  const canAdd = title.trim() !== '' && waitingOn.trim() !== ''

  const submit = async () => {
    if (!canAdd) return
    await createAction({
      title: title.trim(),
      status: 'waiting',
      waitingOn: waitingOn.trim(),
      followUpDate: followUp ? parseLocalDate(followUp) : undefined,
      projectId,
    })
    close()
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
      className="mb-4 flex flex-col gap-2 rounded-lg border border-neutral-800 bg-neutral-900 p-4"
    >
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What are you waiting for?"
        className={field}
      />
      <SimilarNotice match={similar} />
      <input
        value={waitingOn}
        onChange={(e) => setWaitingOn(e.target.value)}
        list="add-waiting-on-names"
        placeholder="Waiting on whom?"
        className={field}
      />
      <datalist id="add-waiting-on-names">
        {names.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <FollowUpDatePicker value={followUp} onChange={setFollowUp} />

      <button
        type="button"
        onClick={() => setMoreOpen((v) => !v)}
        aria-expanded={moreOpen}
        className="self-start text-xs text-neutral-500 hover:text-neutral-300"
      >
        {moreOpen ? '▾' : '▸'} More options
      </button>
      {moreOpen && <ProjectPicker value={projectId} onChange={setProjectId} title={title} />}

      <div className="flex items-center justify-between pt-1">
        <button type="button" onClick={close} className="text-xs text-neutral-500 hover:text-neutral-300">
          Cancel
        </button>
        <button
          type="submit"
          disabled={!canAdd}
          title={!canAdd ? 'Say what you are waiting for, and on whom' : undefined}
          className="rounded-md bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </form>
  )
}
