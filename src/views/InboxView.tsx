import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db/db'
import { ClarifyModal } from '../components/ClarifyModal'
import type { Action } from '../db/types'

export function InboxView() {
  const items = useLiveQuery(() => db.actions.where('status').equals('inbox').sortBy('createdAt'))
  const [clarifying, setClarifying] = useState<Action | null>(null)

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-1 text-xl font-semibold text-neutral-100">Inbox</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Capture everything here first. Then process each item, one at a time, from the top — decide what it is and
        what to do with it before moving to the next.
      </p>

      {items?.length === 0 && (
        <div className="rounded-lg border border-dashed border-neutral-800 p-8 text-center text-sm text-neutral-500">
          Inbox zero. Nice.
        </div>
      )}

      <div className="flex flex-col divide-y divide-neutral-900">
        {items?.map((item) => (
          <div key={item.id} className="flex items-center justify-between py-3">
            <span className="text-sm text-neutral-100">{item.title}</span>
            <button
              onClick={() => setClarifying(item)}
              className="rounded-md bg-neutral-800 px-3 py-1 text-xs font-medium text-neutral-200 hover:bg-emerald-600 hover:text-white"
            >
              Clarify →
            </button>
          </div>
        ))}
      </div>

      {clarifying && <ClarifyModal item={clarifying} onClose={() => setClarifying(null)} />}
    </div>
  )
}
