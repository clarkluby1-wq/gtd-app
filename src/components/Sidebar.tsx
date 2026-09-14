import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'

export type ViewKey =
  | 'inbox'
  | 'next'
  | 'projects'
  | 'waiting'
  | 'someday'
  | 'calendar'
  | 'areas'
  | 'review'

const NAV: { key: ViewKey; label: string; icon: string }[] = [
  { key: 'inbox', label: 'Inbox', icon: '📥' },
  { key: 'next', label: 'Next Actions', icon: '✅' },
  { key: 'projects', label: 'Projects', icon: '📁' },
  { key: 'waiting', label: 'Waiting For', icon: '⏳' },
  { key: 'someday', label: 'Someday / Maybe', icon: '🌙' },
  { key: 'calendar', label: 'Calendar', icon: '📅' },
  { key: 'areas', label: 'Areas of Focus', icon: '🧭' },
  { key: 'review', label: 'Weekly Review', icon: '🔄' },
]

export function Sidebar({ current, onSelect }: { current: ViewKey; onSelect: (v: ViewKey) => void }) {
  const inboxCount = useLiveQuery(() => db.actions.where('status').equals('inbox').count())
  const nextCount = useLiveQuery(() => db.actions.where('status').equals('next').count())
  const waitingCount = useLiveQuery(() => db.actions.where('status').equals('waiting').count())

  const badge = (key: ViewKey): number | undefined => {
    if (key === 'inbox') return inboxCount
    if (key === 'next') return nextCount
    if (key === 'waiting') return waitingCount
    return undefined
  }

  return (
    <nav className="flex h-full w-56 flex-col gap-1 border-r border-neutral-800 bg-neutral-950 p-3 text-neutral-200">
      <div className="mb-4 px-2 text-lg font-semibold tracking-tight text-white">GTD</div>
      {NAV.map((item) => {
        const count = badge(item.key)
        const active = current === item.key
        return (
          <button
            key={item.key}
            onClick={() => onSelect(item.key)}
            className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
              active ? 'bg-emerald-600/20 text-emerald-300' : 'hover:bg-neutral-800 text-neutral-300'
            }`}
          >
            <span className="flex items-center gap-2">
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </span>
            {!!count && (
              <span className="rounded-full bg-neutral-700 px-2 py-0.5 text-xs text-neutral-200">{count}</span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
