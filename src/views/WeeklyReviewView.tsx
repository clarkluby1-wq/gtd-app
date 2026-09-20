import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState, type ReactNode } from 'react'
import { v4 as uuid } from 'uuid'
import { db } from '../db/db'
import { backupAgeLabel, createBackup, getLastBackupAt, isBackupDue } from '../db/backup'
import { ageInDays, staleNextActions } from '../lib/staleness'
import { lastContactAt } from '../lib/waiting'
import { isProjectStalled } from '../lib/projectHealth'
import { useSomedayProjectIds } from '../lib/useSomedayProjectIds'
import type { ViewKey } from '../components/Sidebar'
import type { WeeklyReview, WeeklyReviewChecklistItem } from '../db/types'

type ReviewPhase = 'clear' | 'current' | 'creative'

interface TemplateItem {
  key: string
  phase: ReviewPhase
  label: string
  subItems?: { key: string; label: string }[]
}

const TEMPLATE: TemplateItem[] = [
  { key: 'collect', phase: 'clear', label: 'Collect loose papers, notes, and stray ideas into the Inbox' },
  {
    key: 'inbox-zero',
    phase: 'clear',
    label: "Clear every inbox to zero — not just this app's",
    subItems: [
      { key: 'app-inbox', label: "This app's Inbox" },
      { key: 'email', label: 'Email' },
      { key: 'physical', label: 'Physical inbox / desk / mail' },
      { key: 'notes', label: 'Notes app' },
      { key: 'messaging', label: 'Other messaging (Slack, texts, voicemail…)' },
    ],
  },
  {
    key: 'next-actions',
    phase: 'current',
    label: 'Review the Next Actions list — cross off done items, add anything missing',
  },
  { key: 'previous-calendar', phase: 'current', label: "Scan last week's calendar for stray follow-ups" },
  { key: 'upcoming-calendar', phase: 'current', label: 'Scan the upcoming calendar for prep work or conflicts' },
  { key: 'waiting-for', phase: 'current', label: 'Review Waiting For — follow up on anything overdue, then click "Followed up"' },
  { key: 'projects', phase: 'current', label: 'Review every active Project — does each still have a next action?' },
  { key: 'backup', phase: 'current', label: 'Back up your data — one click keeps a safe copy' },
  {
    key: 'someday-maybe',
    phase: 'creative',
    label: 'Review Someday/Maybe — anything ready to activate, or ready to drop?',
  },
  { key: 'areas-of-focus', phase: 'creative', label: 'Scan Areas of Focus — is anything being neglected?' },
  { key: 'creative', phase: 'creative', label: 'Any new projects, ideas, or commitments to capture?' },
]

const PHASES: { key: ReviewPhase; label: string; blurb: string }[] = [
  { key: 'clear', label: 'Get Clear', blurb: 'Empty your head and every inbox — nothing hidden, nothing forgotten.' },
  { key: 'current', label: 'Get Current', blurb: "Bring every list up to date with what's actually true right now." },
  { key: 'creative', label: 'Get Creative', blurb: "Look up and out — what haven't you captured yet?" },
]

const PHASE_BY_KEY: Record<string, ReviewPhase> = Object.fromEntries(TEMPLATE.map((t) => [t.key, t.phase]))

/** Which substring of a top-level item's label links to which view. First occurrence only. */
const LABEL_LINKS: Record<string, { text: string; view: ViewKey }> = {
  collect: { text: 'Inbox', view: 'inbox' },
  'next-actions': { text: 'Next Actions', view: 'next' },
  'previous-calendar': { text: 'calendar', view: 'calendar' },
  'upcoming-calendar': { text: 'calendar', view: 'calendar' },
  'waiting-for': { text: 'Waiting For', view: 'waiting' },
  projects: { text: 'Project', view: 'projects' },
  'someday-maybe': { text: 'Someday/Maybe', view: 'someday' },
  'areas-of-focus': { text: 'Areas of Focus', view: 'areas' },
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

function isItemDone(item: WeeklyReviewChecklistItem) {
  return item.subItems ? item.subItems.every((s) => s.done) : item.done
}

/** Merge a saved checklist (possibly from an older template shape) onto the current template. */
function normalizeChecklist(saved: WeeklyReviewChecklistItem[] | undefined): WeeklyReviewChecklistItem[] {
  const savedByKey = new Map((saved ?? []).map((c) => [c.key, c]))
  return TEMPLATE.map((t) => {
    const existing = savedByKey.get(t.key)
    if (!t.subItems) {
      return { key: t.key, label: t.label, done: existing?.done ?? false }
    }
    const existingSubByKey = new Map((existing?.subItems ?? []).map((s) => [s.key, s]))
    const subItems = t.subItems.map((s) => ({
      key: s.key,
      label: s.label,
      done: existingSubByKey.get(s.key)?.done ?? false,
    }))
    return { key: t.key, label: t.label, done: subItems.every((s) => s.done), subItems }
  })
}

function linkifyLabel(text: string, link: { text: string; view: ViewKey } | undefined, onNavigate: (view: ViewKey) => void): ReactNode {
  if (!link) return text
  const idx = text.indexOf(link.text)
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onNavigate(link.view)
        }}
        className="underline decoration-dotted underline-offset-2 hover:text-emerald-400"
      >
        {link.text}
      </button>
      {text.slice(idx + link.text.length)}
    </>
  )
}

function startOfWeek(d: Date) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = (day + 6) % 7 // days since Monday
  date.setDate(date.getDate() - diff)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

export function WeeklyReviewView({ onNavigate }: { onNavigate: (view: ViewKey) => void }) {
  const [weekStart] = useState(() => startOfWeek(new Date()))
  const [lastBackupAt, setLastBackupAt] = useState(getLastBackupAt())
  const review = useLiveQuery(() => db.weeklyReviews.where('date').equals(weekStart).first(), [weekStart])
  const allReviews = useLiveQuery(() => db.weeklyReviews.toArray())

  const ensureReview = async (): Promise<WeeklyReview> => {
    if (review) return review
    const fresh: WeeklyReview = { id: uuid(), date: weekStart, checklist: normalizeChecklist(undefined) }
    await db.weeklyReviews.add(fresh)
    return fresh
  }

  const saveChecklist = async (r: WeeklyReview, checklist: WeeklyReviewChecklistItem[]) => {
    const allDone = checklist.every(isItemDone)
    await db.weeklyReviews.put({ ...r, checklist, completedAt: allDone ? Date.now() : undefined })
  }

  const toggle = async (key: string) => {
    const r = await ensureReview()
    const checklist = normalizeChecklist(r.checklist).map((c) => (c.key === key ? { ...c, done: !c.done } : c))
    await saveChecklist(r, checklist)
  }

  /** Backing up counts as doing that step, so it ticks itself. */
  const backUpNow = async () => {
    await createBackup()
    setLastBackupAt(getLastBackupAt())
    const r = await ensureReview()
    const current = normalizeChecklist(r.checklist)
    if (current.find((c) => c.key === 'backup')?.done) return
    await saveChecklist(
      r,
      current.map((c) => (c.key === 'backup' ? { ...c, done: true } : c)),
    )
  }

  const toggleSub = async (parentKey: string, subKey: string) => {
    const r = await ensureReview()
    const checklist = normalizeChecklist(r.checklist).map((c) => {
      if (c.key !== parentKey || !c.subItems) return c
      const subItems = c.subItems.map((s) => (s.key === subKey ? { ...s, done: !s.done } : s))
      return { ...c, subItems, done: subItems.every((s) => s.done) }
    })
    await saveChecklist(r, checklist)
  }

  const checklist = normalizeChecklist(review?.checklist)
  const doneCount = checklist.filter(isItemDone).length

  const completedWeeks = useMemo(
    () => new Set((allReviews ?? []).filter((r) => r.completedAt).map((r) => r.date)),
    [allReviews],
  )
  const isComplete = completedWeeks.has(weekStart)
  const streak = useMemo(() => {
    let count = 0
    let cursor = completedWeeks.has(weekStart) ? weekStart : weekStart - WEEK_MS
    while (completedWeeks.has(cursor)) {
      count++
      cursor -= WEEK_MS
    }
    return count
  }, [completedWeeks, weekStart])

  const activeProjects = useLiveQuery(() => db.projects.where('status').equals('active').toArray())
  const areas = useLiveQuery(() => db.areasOfFocus.toArray())
  const allActions = useLiveQuery(() => db.actions.toArray())
  const somedayProjectIds = useSomedayProjectIds()
  const inboxCount = useLiveQuery(() => db.actions.where('status').equals('inbox').count())

  const orphanedProjects = activeProjects?.filter((p) => !p.areaOfFocusId && !p.goalId) ?? []
  const neglectedAreas = areas?.filter((a) => !activeProjects?.some((p) => p.areaOfFocusId === a.id)) ?? []

  const nextActions = useMemo(
    () =>
      (allActions ?? []).filter((a) => a.status === 'next' && (!a.projectId || !somedayProjectIds.has(a.projectId))),
    [allActions, somedayProjectIds],
  )
  const staleCount = useMemo(
    () => staleNextActions(allActions ?? [], somedayProjectIds).length,
    [allActions, somedayProjectIds],
  )
  const waitingActions = useMemo(
    () =>
      (allActions ?? []).filter(
        (a) => a.status === 'waiting' && (!a.projectId || !somedayProjectIds.has(a.projectId)),
      ),
    [allActions, somedayProjectIds],
  )
  const oldestWaitingDays = waitingActions.length
    ? Math.max(...waitingActions.map((a) => ageInDays(lastContactAt(a))))
    : null
  const stalledProjects = useMemo(
    () => (activeProjects ?? []).filter((p) => isProjectStalled(p, allActions ?? [])),
    [activeProjects, allActions],
  )

  const backupDue = isBackupDue(lastBackupAt)

  const badges: Record<string, ReactNode> = {
    'next-actions':
      nextActions.length === 0
        ? 'nothing open'
        : `${nextActions.length} open${staleCount > 0 ? ` · ${staleCount} stale` : ''}`,
    'waiting-for':
      waitingActions.length === 0
        ? 'nothing pending'
        : `${waitingActions.length} pending · longest quiet ${oldestWaitingDays}d`,
    projects:
      (activeProjects?.length ?? 0) === 0
        ? 'no active projects'
        : stalledProjects.length > 0
          ? `${stalledProjects.length} stalled`
          : `${activeProjects?.length} active, all covered`,
    backup: (
      <span className={backupDue ? 'text-amber-400' : undefined}>
        {lastBackupAt === null ? 'never backed up' : `last file ${backupAgeLabel(lastBackupAt)}`}
      </span>
    ),
  }

  const extras: Record<string, ReactNode> = {
    backup: (
      <button
        type="button"
        onClick={() => void backUpNow()}
        className="rounded-md bg-neutral-800 px-2.5 py-1 text-xs font-medium text-neutral-200 hover:bg-emerald-600 hover:text-white"
      >
        Back up now
      </button>
    ),
  }

  const subBadges: Record<string, Record<string, ReactNode>> = {
    'inbox-zero': {
      'app-inbox':
        inboxCount == null ? undefined : inboxCount === 0 ? 'zero ✓' : `${inboxCount} item${inboxCount === 1 ? '' : 's'}`,
    },
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-1 text-xl font-semibold text-neutral-100">Weekly Review</h1>
      <p className="mb-6 text-sm text-neutral-500">
        The habit that keeps the whole system trustworthy. Set aside time weekly and work through this list.
      </p>

      <div className="mb-1 flex items-center justify-between text-xs text-neutral-500">
        <span>
          {doneCount} / {checklist.length} complete this week
        </span>
        {streak > 0 && (
          <span className="text-amber-400">
            🔥 {streak} week{streak === 1 ? '' : 's'} in a row
          </span>
        )}
      </div>
      <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
        <div
          className="h-full bg-emerald-600 transition-all"
          style={{ width: `${(doneCount / checklist.length) * 100}%` }}
        />
      </div>

      {isComplete && (
        <div className="mb-6 rounded-lg border border-emerald-900/50 bg-emerald-950/20 p-4 text-center">
          <div className="text-2xl" aria-hidden>
            🎉
          </div>
          <div className="mt-1 text-sm font-medium text-emerald-300">Weekly Review complete</div>
          {streak > 1 && (
            <div className="mt-0.5 text-xs text-emerald-400/80">
              {streak} weeks in a row — the system stays trustworthy because of this.
            </div>
          )}
        </div>
      )}

      {(orphanedProjects.length > 0 || neglectedAreas.length > 0) && (
        <div className="mb-6 flex flex-col gap-2 rounded-lg border border-amber-900/50 bg-amber-950/20 p-4 text-sm">
          {orphanedProjects.length > 0 && (
            <div className="text-amber-300">
              ⚠ {orphanedProjects.length} active project{orphanedProjects.length > 1 ? 's' : ''} not linked to
              any Area of Focus or Goal: {orphanedProjects.map((p) => p.title).join(', ')}
            </div>
          )}
          {neglectedAreas.length > 0 && (
            <div className="text-amber-300">
              ⚠ No active projects in: {neglectedAreas.map((a) => a.name).join(', ')}
            </div>
          )}
        </div>
      )}

      {PHASES.map((phase) => {
        const items = checklist.filter((c) => PHASE_BY_KEY[c.key] === phase.key)
        const phaseDone = items.filter(isItemDone).length
        return (
          <div key={phase.key} className="mb-6">
            <div className="mb-0.5 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-neutral-200">{phase.label}</h2>
              <span className="text-xs text-neutral-500">
                {phaseDone}/{items.length}
              </span>
            </div>
            <p className="mb-2 text-xs text-neutral-500">{phase.blurb}</p>
            <div className="flex flex-col divide-y divide-neutral-900 rounded-lg border border-neutral-900 px-3">
              {items.map((c) => (
                <ChecklistRow
                  key={c.key}
                  item={c}
                  badge={badges[c.key]}
                  extra={extras[c.key]}
                  subBadges={subBadges[c.key]}
                  onToggle={toggle}
                  onToggleSub={toggleSub}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ChecklistRow({
  item,
  badge,
  extra,
  subBadges,
  onToggle,
  onToggleSub,
  onNavigate,
}: {
  item: WeeklyReviewChecklistItem
  badge?: ReactNode
  /** A button that belongs to this step, shown at the end of its row. */
  extra?: ReactNode
  subBadges?: Record<string, ReactNode>
  onToggle: (key: string) => void
  onToggleSub: (parentKey: string, subKey: string) => void
  onNavigate: (view: ViewKey) => void
}) {
  const done = isItemDone(item)
  const subProgress = item.subItems ? `${item.subItems.filter((s) => s.done).length}/${item.subItems.length}` : null

  return (
    <div className="py-3">
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id={`review-${item.key}`}
          checked={done}
          disabled={!!item.subItems}
          onChange={() => onToggle(item.key)}
          className="h-4 w-4 accent-emerald-600 disabled:opacity-40"
        />
        <label
          htmlFor={`review-${item.key}`}
          className={`text-sm ${item.subItems ? '' : 'cursor-pointer'} ${
            done ? 'text-neutral-500 line-through' : 'text-neutral-100'
          }`}
        >
          {linkifyLabel(item.label, LABEL_LINKS[item.key], onNavigate)}
        </label>
        {(badge ?? subProgress) && (
          <span className="ml-auto shrink-0 text-xs text-neutral-500">{badge ?? subProgress}</span>
        )}
        {extra && <span className={badge ?? subProgress ? 'shrink-0' : 'ml-auto shrink-0'}>{extra}</span>}
      </div>

      {item.subItems && (
        <div className="ml-7 mt-2 flex flex-col gap-2">
          {item.subItems.map((s) => (
            <div key={s.key} className="flex items-center gap-3">
              <input
                type="checkbox"
                id={`review-${item.key}-${s.key}`}
                aria-label={s.label}
                checked={s.done}
                onChange={() => onToggleSub(item.key, s.key)}
                className="h-3.5 w-3.5 accent-emerald-600"
              />
              <label
                htmlFor={`review-${item.key}-${s.key}`}
                className={`cursor-pointer text-sm ${s.done ? 'text-neutral-500 line-through' : 'text-neutral-300'}`}
              >
                {s.key === 'app-inbox' ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onNavigate('inbox')
                    }}
                    className="underline decoration-dotted underline-offset-2 hover:text-emerald-400"
                  >
                    {s.label}
                  </button>
                ) : (
                  s.label
                )}
              </label>
              {subBadges?.[s.key] && <span className="ml-auto text-xs text-neutral-500">{subBadges[s.key]}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
