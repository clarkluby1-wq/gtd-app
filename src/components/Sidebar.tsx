import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db/db'
import { useCompletionToast } from '../lib/completionToastContext'
import { startOfToday } from '../lib/date'
import { useSomedayProjectIds } from '../lib/useSomedayProjectIds'

export type ViewKey =
  | 'search'
  | 'dashboard'
  | 'completed'
  | 'inbox'
  | 'next'
  | 'whatnow'
  | 'projects'
  | 'waiting'
  | 'someday'
  | 'calendar'
  | 'reference'
  | 'purpose'
  | 'vision'
  | 'goals'
  | 'areas'
  | 'recurring'
  | 'review'
  | 'settings'

const SEARCH_SHORTCUT =
  typeof navigator !== 'undefined' && /Mac/.test(navigator.platform) ? '⌘K' : 'Ctrl K'

const MAIN_NAV: { key: ViewKey; label: string; icon: string; extra?: string }[] = [
  { key: 'search', label: 'Search', icon: '🔍', extra: SEARCH_SHORTCUT },
  { key: 'dashboard', label: 'Dashboard', icon: '📊' },
  { key: 'inbox', label: 'Inbox', icon: '📥' },
  { key: 'completed', label: 'Recently Completed', icon: '☑️' },
  { key: 'next', label: 'Next Actions', icon: '✅' },
  { key: 'whatnow', label: 'What Now?', icon: '❓' },
  { key: 'projects', label: 'Projects', icon: '📁' },
  { key: 'waiting', label: 'Waiting For', icon: '⏳' },
  { key: 'someday', label: 'Someday / Maybe', icon: '🌙' },
  { key: 'calendar', label: 'Calendar', icon: '📅' },
  { key: 'reference', label: 'Reference', icon: '📎' },
]

const HORIZONS_NAV: { key: ViewKey; label: string; icon: string; altitude: string }[] = [
  { key: 'purpose', label: 'Purpose & Principles', icon: '🌟', altitude: '50k ft' },
  { key: 'vision', label: 'Vision', icon: '🔭', altitude: '40k ft' },
  { key: 'goals', label: 'Goals', icon: '🎯', altitude: '30k ft' },
  { key: 'areas', label: 'Areas of Focus', icon: '🧭', altitude: '20k ft' },
]

const BOTTOM_NAV: { key: ViewKey; label: string; icon: string }[] = [
  { key: 'recurring', label: 'Recurring', icon: '🔁' },
  { key: 'review', label: 'Weekly Review', icon: '🔄' },
]

export function Sidebar({
  current,
  onSelect,
  onStartIntake,
  onStartMindSweep,
}: {
  current: ViewKey
  onSelect: (v: ViewKey) => void
  onStartIntake: () => void
  onStartMindSweep: () => void
}) {
  const { blocked } = useCompletionToast()
  const [horizonsOpen, setHorizonsOpen] = useState(true)
  const somedayProjectIds = useSomedayProjectIds()
  const inboxCount = useLiveQuery(() => db.actions.where('status').equals('inbox').count())
  const nextActions = useLiveQuery(() => db.actions.where('status').equals('next').toArray())
  const waitingActions = useLiveQuery(() => db.actions.where('status').equals('waiting').toArray())
  const doneActions = useLiveQuery(() => db.actions.where('status').equals('done').toArray())
  const completedTodayCount = doneActions?.filter((a) => (a.completedAt ?? 0) >= startOfToday()).length
  const notParked = (a: { projectId?: string }) => !a.projectId || !somedayProjectIds.has(a.projectId)
  const nextCount = nextActions?.filter(notParked).length
  const waitingCount = waitingActions?.filter(notParked).length

  const badge = (key: ViewKey): number | undefined => {
    if (key === 'inbox') return inboxCount
    if (key === 'next') return nextCount
    if (key === 'waiting') return waitingCount
    if (key === 'completed') return completedTodayCount
    return undefined
  }

  const item = (key: ViewKey, label: string, icon: string, extra?: string) => {
    const count = badge(key)
    const active = current === key
    return (
      <button
        key={key}
        onClick={() => onSelect(key)}
        className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
          active ? 'bg-emerald-600/20 text-emerald-300' : 'hover:bg-neutral-800 text-neutral-300'
        }`}
      >
        <span className="flex items-center gap-2">
          <span>{icon}</span>
          <span>{label}</span>
        </span>
        {extra && <span className="text-[10px] text-neutral-600">{extra}</span>}
        {!!count && (
          <span className="rounded-full bg-neutral-700 px-2 py-0.5 text-xs text-neutral-200">{count}</span>
        )}
      </button>
    )
  }

  return (
    <nav
      inert={blocked}
      className="flex h-full w-60 flex-col gap-1 overflow-y-auto border-r border-neutral-800 bg-neutral-950 p-3 text-neutral-200"
    >
      <div className="mb-4 px-2 text-lg font-semibold tracking-tight text-white">GTD</div>
      {MAIN_NAV.map((n) => item(n.key, n.label, n.icon, n.extra))}

      <div className="mt-4 flex items-center justify-between px-3 py-1">
        <button
          onClick={() => setHorizonsOpen((v) => !v)}
          className="text-xs font-medium uppercase tracking-wide text-neutral-500 hover:text-neutral-300"
        >
          Horizons of Focus {horizonsOpen ? '▾' : '▸'}
        </button>
        <button onClick={onStartIntake} className="text-[10px] text-emerald-500 hover:text-emerald-400">
          Guided setup
        </button>
      </div>
      {horizonsOpen && HORIZONS_NAV.map((n) => item(n.key, n.label, n.icon, n.altitude))}

      <div className="mt-4 border-t border-neutral-800 pt-2">
        {BOTTOM_NAV.map((n) => item(n.key, n.label, n.icon))}
        <button
          onClick={onStartMindSweep}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
        >
          <span>🧹</span>
          <span>Mind Sweep</span>
        </button>
        {item('settings', 'Settings', '⚙️')}
      </div>
    </nav>
  )
}
