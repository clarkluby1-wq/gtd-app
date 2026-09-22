import { useState } from 'react'
import { useCompletionToast } from '../lib/completionToastContext'
import { useNavBadges } from '../lib/useNavBadges'
import { useReviewStatus } from '../lib/useReviewStatus'
import { useSync } from '../lib/useSync'

export type ViewKey =
  | 'search'
  | 'today'
  | 'startday'
  | 'report'
  | 'focus'
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

export interface NavItem {
  key: ViewKey
  label: string
  icon: string
  extra?: string
}

// The menu is grouped by how often it's used: what you do every day, what you keep track of, then two folded-away
// groups. What Now? isn't listed — it's reached from Next Actions and Start My Day.
export const SEARCH_ITEM: NavItem = { key: 'search', label: 'Search', icon: '🔍', extra: SEARCH_SHORTCUT }

export const DO_NAV: NavItem[] = [
  { key: 'today', label: 'Today', icon: '🏠' },
  { key: 'startday', label: 'Start My Day', icon: '☀️' },
  { key: 'report', label: "What I've Done", icon: '✨' },
  { key: 'inbox', label: 'Inbox', icon: '📥' },
  { key: 'next', label: 'Next Actions', icon: '✅' },
]

export const TRACK_NAV: NavItem[] = [
  { key: 'projects', label: 'Projects', icon: '📁' },
  { key: 'waiting', label: 'Waiting For', icon: '⏳' },
  { key: 'calendar', label: 'Calendar', icon: '📅' },
  { key: 'someday', label: 'Someday / Maybe', icon: '🌙' },
]

export const REVIEW_NAV: NavItem[] = [
  { key: 'review', label: 'Weekly Review', icon: '🔄' },
  { key: 'dashboard', label: 'Dashboard', icon: '📊' },
  { key: 'completed', label: 'Recently Completed', icon: '☑️' },
]

export const MORE_NAV: NavItem[] = [
  { key: 'reference', label: 'Reference', icon: '📎' },
  { key: 'recurring', label: 'Recurring', icon: '🔁' },
]

export const HORIZONS_NAV: (NavItem & { altitude: string })[] = [
  { key: 'purpose', label: 'Purpose & Principles', icon: '🌟', altitude: '50k ft' },
  { key: 'vision', label: 'Vision', icon: '🔭', altitude: '40k ft' },
  { key: 'goals', label: 'Goals', icon: '🎯', altitude: '30k ft' },
  { key: 'areas', label: 'Areas of Focus', icon: '🧭', altitude: '20k ft' },
]

export const SETTINGS_ITEM: NavItem = { key: 'settings', label: 'Settings', icon: '⚙️' }

const REVIEW_KEYS: ViewKey[] = REVIEW_NAV.map((n) => n.key)
const MORE_KEYS: ViewKey[] = [...MORE_NAV.map((n) => n.key), ...HORIZONS_NAV.map((n) => n.key), 'settings']

type FoldedGroup = 'review' | 'more'
const OPEN_KEY = 'gtd.sidebar.open'

/** Which folded groups you left open. Both start closed; a group also shows open whenever you're inside it. */
function readOpen(): Record<FoldedGroup, boolean> {
  try {
    const saved = JSON.parse(localStorage.getItem(OPEN_KEY) ?? '{}')
    return { review: saved.review === true, more: saved.more === true }
  } catch {
    return { review: false, more: false }
  }
}

function writeOpen(value: Record<FoldedGroup, boolean>) {
  try {
    localStorage.setItem(OPEN_KEY, JSON.stringify(value))
  } catch {
    // Not remembering is fine; the groups just start closed next time.
  }
}

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
  const [stored, setStored] = useState(readOpen)
  const reviewStatus = useReviewStatus()
  const sync = useSync()
  const reviewNeedsAttention = reviewStatus.phase === 'today' || reviewStatus.phase === 'open'
  const badges = useNavBadges()

  const badge = (key: ViewKey): number | undefined => {
    if (key === 'inbox') return badges.inbox
    if (key === 'next') return badges.next
    if (key === 'waiting') return badges.waiting
    if (key === 'completed') return badges.completedToday
    return undefined
  }

  const isOpen = (group: FoldedGroup, keys: ViewKey[]) => stored[group] || keys.includes(current)
  const toggle = (group: FoldedGroup) => {
    const next = { ...stored, [group]: !stored[group] }
    setStored(next)
    writeOpen(next)
  }

  const item = ({ key, label, icon, extra }: NavItem) => {
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

  const label = (text: string) => (
    <div className="mt-4 px-3 py-1 text-xs font-medium uppercase tracking-wide text-neutral-500">{text}</div>
  )

  const foldedHeader = (text: string, group: FoldedGroup, open: boolean, dot = false) => (
    <button
      onClick={() => toggle(group)}
      aria-expanded={open}
      className="mt-4 flex items-center justify-between px-3 py-1 text-left text-xs font-medium uppercase tracking-wide text-neutral-500 hover:text-neutral-300"
    >
      <span className="flex items-center gap-2">
        {text}
        {dot && !open && (
          <span title="Your Weekly Review is due" className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-label="Weekly Review due" />
        )}
      </span>
      <span>{open ? '▾' : '▸'}</span>
    </button>
  )

  const reviewOpen = isOpen('review', REVIEW_KEYS)
  const moreOpen = isOpen('more', MORE_KEYS)

  return (
    <nav
      inert={blocked}
      className="hidden h-full w-60 flex-col gap-1 overflow-y-auto border-r border-neutral-800 bg-neutral-950 p-3 text-neutral-200 md:flex"
    >
      <div className="mb-3 px-2 text-lg font-semibold tracking-tight text-white">GTD</div>
      {item(SEARCH_ITEM)}

      {label('Do')}
      {DO_NAV.map(item)}

      {label('Track')}
      {TRACK_NAV.map(item)}

      {foldedHeader('Review', 'review', reviewOpen, reviewNeedsAttention)}
      {reviewOpen && REVIEW_NAV.map(item)}

      {foldedHeader('Set up & more', 'more', moreOpen)}
      {moreOpen && (
        <>
          {MORE_NAV.map(item)}
          <button
            onClick={onStartMindSweep}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
          >
            <span>🧹</span>
            <span>Mind Sweep</span>
          </button>

          <div className="mt-3 flex items-center justify-between px-3 py-1">
            <span className="text-[11px] font-medium uppercase tracking-wide text-neutral-600">Horizons of Focus</span>
            <button onClick={onStartIntake} className="text-[10px] text-emerald-500 hover:text-emerald-400">
              Guided setup
            </button>
          </div>
          {HORIZONS_NAV.map((n) => item({ ...n, extra: n.altitude }))}

          <div className="mt-2">{item(SETTINGS_ITEM)}</div>
        </>
      )}

      {sync.signedIn && (
        <div className="mt-auto flex items-center gap-2 px-3 pb-1 pt-4 text-xs text-neutral-500" title={sync.label}>
          <span
            aria-hidden
            className={`h-1.5 w-1.5 rounded-full ${
              sync.kind === 'synced' ? 'bg-emerald-500' : sync.kind === 'error' ? 'bg-red-500' : sync.kind === 'offline' ? 'bg-neutral-500' : 'bg-amber-400'
            }`}
          />
          {sync.kind === 'synced' ? 'Synced' : sync.kind === 'offline' ? 'Offline' : sync.kind === 'error' ? 'Sync problem' : 'Syncing…'}
        </div>
      )}
    </nav>
  )
}
