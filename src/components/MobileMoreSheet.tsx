import { useEffect } from 'react'
import { useNavBadges } from '../lib/useNavBadges'
import { useSync } from '../lib/useSync'
import {
  DO_NAV,
  HORIZONS_NAV,
  MORE_NAV,
  REVIEW_NAV,
  SEARCH_ITEM,
  SETTINGS_ITEM,
  TRACK_NAV,
  type NavItem,
  type ViewKey,
} from './Sidebar'

/**
 * Every screen, one slide-up sheet away. Same groups and order as the desktop sidebar, just flat (it's already
 * tucked behind "More", so there's no need to fold it further).
 */
export function MobileMoreSheet({
  current,
  onSelect,
  onClose,
  onStartIntake,
  onStartMindSweep,
}: {
  current: ViewKey
  onSelect: (v: ViewKey) => void
  onClose: () => void
  onStartIntake: () => void
  onStartMindSweep: () => void
}) {
  const sync = useSync()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const badges = useNavBadges()
  const countFor = (key: ViewKey): number | undefined =>
    key === 'inbox' ? badges.inbox : key === 'next' ? badges.next : key === 'waiting' ? badges.waiting : undefined

  // Everything is listed, even what's also on the tab bar: this sheet slides up over that bar, so leaving Inbox out
  // made it look like it had vanished.
  const groups: { label?: string; items: NavItem[] }[] = [
    { items: [SEARCH_ITEM] },
    { items: DO_NAV },
    { label: 'Track', items: TRACK_NAV },
    { label: 'Review', items: REVIEW_NAV },
    { label: 'Set up & more', items: MORE_NAV },
  ]

  const row = (item: NavItem) => {
    const count = countFor(item.key)
    return (
      <button
        key={item.key}
        onClick={() => {
          onSelect(item.key)
          onClose()
        }}
        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm ${
          current === item.key ? 'bg-emerald-600/20 text-emerald-300' : 'text-neutral-200 hover:bg-neutral-800'
        }`}
      >
        <span aria-hidden>{item.icon}</span>
        {item.label}
        {!!count && (
          <span className="ml-auto rounded-full bg-neutral-700 px-2 py-0.5 text-xs text-neutral-200">{count}</span>
        )}
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60 md:hidden" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="More"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full flex-col overflow-y-auto rounded-t-2xl border-t border-neutral-800 bg-neutral-950 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]"
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-neutral-800 bg-neutral-950 px-4 py-3">
          <span className="text-sm font-medium text-neutral-100">More</span>
          <button onClick={onClose} className="text-sm text-neutral-500 hover:text-neutral-300">
            Close
          </button>
        </div>

        <div className="flex flex-col gap-1 p-3">
          {groups.map((g, i) => (
            <div key={g.label ?? i} className={i > 0 ? 'mt-2' : ''}>
              {g.label && <div className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-neutral-500">{g.label}</div>}
              {g.items.map(row)}
            </div>
          ))}

          <button
            onClick={() => {
              onStartMindSweep()
              onClose()
            }}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-neutral-200 hover:bg-neutral-800"
          >
            <span aria-hidden>🧹</span>
            Mind Sweep
          </button>

          <div className="mt-3 flex items-center justify-between px-3 py-1">
            <span className="text-[11px] font-medium uppercase tracking-wide text-neutral-600">Horizons of Focus</span>
            <button
              onClick={() => {
                onStartIntake()
                onClose()
              }}
              className="text-[10px] text-emerald-500 hover:text-emerald-400"
            >
              Guided setup
            </button>
          </div>
          {HORIZONS_NAV.map((n) => row(n))}

          <div className="mt-2">{row(SETTINGS_ITEM)}</div>

          {sync.signedIn && (
            <div className="mt-3 flex items-center gap-2 px-3 pb-1 text-xs text-neutral-500" title={sync.label}>
              <span
                aria-hidden
                className={`h-1.5 w-1.5 rounded-full ${
                  sync.kind === 'synced' ? 'bg-emerald-500' : sync.kind === 'error' ? 'bg-red-500' : sync.kind === 'offline' ? 'bg-neutral-500' : 'bg-amber-400'
                }`}
              />
              {sync.kind === 'synced' ? 'Synced' : sync.kind === 'offline' ? 'Offline' : sync.kind === 'error' ? 'Sync problem' : 'Syncing…'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
