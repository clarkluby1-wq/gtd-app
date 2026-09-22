import { useNavBadges } from '../lib/useNavBadges'
import type { ViewKey } from './Sidebar'

const TABS: { key: ViewKey; label: string; icon: string }[] = [
  { key: 'today', label: 'Today', icon: '🏠' },
  { key: 'inbox', label: 'Inbox', icon: '📥' },
  { key: 'next', label: 'Next', icon: '✅' },
  { key: 'projects', label: 'Projects', icon: '📁' },
]

/**
 * The phone-width equivalent of the sidebar: the four screens used all day, always one thumb-tap away, plus
 * "More" for everything else. Hidden on wider screens, where the full sidebar takes over.
 */
export function MobileTabBar({
  current,
  onSelect,
  onMore,
  moreActive,
}: {
  current: ViewKey
  onSelect: (v: ViewKey) => void
  onMore: () => void
  /** True while a screen reachable only through "More" is open, so that tab can show as active too. */
  moreActive: boolean
}) {
  const badges = useNavBadges()
  const badgeFor = (key: ViewKey) => (key === 'inbox' ? badges.inbox : key === 'next' ? badges.next : undefined)

  const tabClass = (active: boolean) =>
    `flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] ${
      active ? 'text-emerald-400' : 'text-neutral-500'
    }`

  return (
    <nav
      className="flex shrink-0 items-stretch border-t border-neutral-800 bg-neutral-950 pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="Sections"
    >
      {TABS.map((t) => {
        const count = badgeFor(t.key)
        const active = current === t.key
        return (
          <button key={t.key} onClick={() => onSelect(t.key)} className={tabClass(active)} aria-current={active ? 'page' : undefined}>
            <span className="relative text-xl leading-none" aria-hidden>
              {t.icon}
              {!!count && (
                <span className="absolute -right-2 -top-1.5 rounded-full bg-neutral-700 px-1 text-[9px] leading-tight text-neutral-100">
                  {count}
                </span>
              )}
            </span>
            {t.label}
          </button>
        )
      })}
      <button onClick={onMore} className={tabClass(moreActive)} aria-haspopup="dialog">
        <span className="text-xl leading-none" aria-hidden>
          ⋯
        </span>
        More
      </button>
    </nav>
  )
}
