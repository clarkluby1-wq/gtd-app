import { useState } from 'react'
import { captureToInbox } from '../db/operations'
import type { Action } from '../db/types'
import { ClarifyModal } from './ClarifyModal'

/**
 * A box for adding a Next Action that walks you straight into Clarify — the same step-by-step as sorting an Inbox
 * item. What you type is captured first, so if you close Clarify without finishing it simply waits in the Inbox and
 * nothing is lost. Inside a project, pass `projectId` and whatever you finish joins that project.
 */
export function AddAndClarify({ placeholder, projectId }: { placeholder: string; projectId?: string }) {
  const [text, setText] = useState('')
  const [clarifying, setClarifying] = useState<Action | null>(null)

  const submit = async () => {
    const title = text.trim()
    if (!title) return
    setText('')
    setClarifying(await captureToInbox(title))
  }

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
        className="flex gap-2"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="rounded-md bg-neutral-800 px-3 py-2 text-xs text-neutral-200 hover:bg-emerald-600 hover:text-white disabled:opacity-40"
        >
          Add
        </button>
      </form>
      {clarifying && <ClarifyModal item={clarifying} projectId={projectId} onClose={() => setClarifying(null)} />}
    </>
  )
}
