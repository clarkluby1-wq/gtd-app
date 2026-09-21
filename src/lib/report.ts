import type { Action, Project } from '../db/types'
import { startOfDay } from './date'
import { startOfReviewWeek } from './reviewSchedule'

/**
 * The "What I've Done" report: what got finished over a stretch of time, worked out from the records. It only ever
 * describes what was done — nothing here compares one period with another or counts what wasn't finished.
 */

export type PeriodKey = 'today' | 'yesterday' | 'week' | 'lastWeek' | 'last30'

export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'This week' },
  { key: 'lastWeek', label: 'Last week' },
  { key: 'last30', label: 'Last 30 days' },
]

export interface Period {
  key: PeriodKey
  label: string
  /** Start-of-day, inclusive. */
  start: number
  /** Start-of-day after the last day, exclusive. */
  end: number
}

function addDays(dayStart: number, days: number): number {
  const d = new Date(dayStart)
  d.setDate(d.getDate() + days)
  return d.getTime()
}

/** Weeks run Monday to Sunday, like the Weekly Review. "This week" is Monday up to and including today. */
export function periodFor(key: PeriodKey, now = Date.now()): Period {
  const today = startOfDay(now)
  const label = PERIODS.find((p) => p.key === key)!.label
  switch (key) {
    case 'today':
      return { key, label, start: today, end: addDays(today, 1) }
    case 'yesterday':
      return { key, label, start: addDays(today, -1), end: today }
    case 'week':
      return { key, label, start: startOfReviewWeek(new Date(now)), end: addDays(today, 1) }
    case 'lastWeek': {
      const thisMonday = startOfReviewWeek(new Date(now))
      return { key, label, start: addDays(thisMonday, -7), end: thisMonday }
    }
    case 'last30':
      return { key, label, start: addDays(today, -29), end: addDays(today, 1) }
  }
}

export function isSingleDay(period: Period): boolean {
  return addDays(period.start, 1) === period.end
}

const withYear = (ts: number, year: boolean) =>
  new Date(ts).toLocaleDateString(undefined, year ? { month: 'short', day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric' })

/** "Monday, September 21" for one day; "Sep 15 – Sep 21, 2026" for a stretch. */
export function rangeLabel(period: Period): string {
  if (isSingleDay(period)) {
    return new Date(period.start).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  }
  const last = addDays(period.end, -1)
  const sameYear = new Date(period.start).getFullYear() === new Date(last).getFullYear()
  return sameYear ? `${withYear(period.start, false)} – ${withYear(last, true)}` : `${withYear(period.start, true)} – ${withYear(last, true)}`
}

export interface ReportItem {
  id: string
  kind: 'action' | 'project'
  title: string
  /** When it was finished. */
  at: number
  /** Was on the Short List during this period. */
  starred: boolean
  projectTitle?: string
  /** The Area of Focus of its project, if it has one. */
  areaId?: string
}

const inPeriod = (ts: number | undefined, period: Period) => ts !== undefined && ts >= period.start && ts < period.end

/** Every finished action and project in the period, as plain report items. Newest first. */
export function buildItems(input: {
  actions: Action[]
  finishedProjects: Project[]
  projects: { id: string; title: string; areaOfFocusId?: string }[]
  period: Period
}): ReportItem[] {
  const { period } = input
  const projectById = new Map(input.projects.map((p) => [p.id, p]))

  const actionItems: ReportItem[] = input.actions
    .filter((a) => a.status === 'done' && inPeriod(a.completedAt, period))
    .map((a) => {
      const project = a.projectId ? projectById.get(a.projectId) : undefined
      return {
        id: a.id,
        kind: 'action' as const,
        title: a.title,
        at: a.completedAt!,
        // A finished action keeps the day it was on the Short List, so this is "what you called important".
        starred: a.bigThreeDate !== undefined && inPeriod(a.bigThreeDate, period),
        projectTitle: project?.title,
        areaId: project?.areaOfFocusId,
      }
    })

  const projectItems: ReportItem[] = input.finishedProjects
    .filter((p) => inPeriod(p.completedAt, period))
    .map((p) => ({ id: p.id, kind: 'project' as const, title: p.title, at: p.completedAt!, starred: false, areaId: p.areaOfFocusId }))

  return [...actionItems, ...projectItems].sort((a, b) => b.at - a.at)
}

export interface ReportParts {
  /** Short List wins, newest first. */
  starred: ReportItem[]
  /** Projects finished. */
  projects: ReportItem[]
  /** Everything else that was finished. */
  others: ReportItem[]
}

/** Splits the items up, leaving out anything you chose not to include. */
export function partsOf(items: ReportItem[], excluded: ReadonlySet<string> = new Set()): ReportParts {
  const kept = items.filter((i) => !excluded.has(i.id))
  return {
    starred: kept.filter((i) => i.kind === 'action' && i.starred),
    projects: kept.filter((i) => i.kind === 'project'),
    others: kept.filter((i) => i.kind === 'action' && !i.starred),
  }
}

export const totalOf = (parts: ReportParts) => parts.starred.length + parts.projects.length + parts.others.length

export type GroupMode = 'day' | 'area'

export interface Group {
  key: string
  /** Empty means "no heading" (a single group, so a heading would say nothing). */
  label: string
  items: ReportItem[]
}

export function dayLabel(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
}

/**
 * Which group an item belongs to. Shared by grouping and by "all / none" on a group heading, so a heading's tick
 * covers everything that group stands for — Short List wins and finished projects included.
 */
export function groupKeyOf(item: ReportItem, mode: GroupMode, areaIds: ReadonlySet<string>, singleDay: boolean): string {
  if (mode === 'day') return singleDay ? 'all' : String(startOfDay(item.at))
  return item.areaId && areaIds.has(item.areaId) ? item.areaId : 'none'
}

/** Groups items by the day they were finished (newest day first) or by the Area of Focus of their project. */
export function groupItems(
  items: ReportItem[],
  mode: GroupMode,
  areas: { id: string; name: string; order: number }[],
  singleDay: boolean,
): Group[] {
  if (items.length === 0) return []

  if (mode === 'day') {
    if (singleDay) return [{ key: 'all', label: '', items }]
    const days = new Map<number, ReportItem[]>()
    for (const item of items) {
      const day = startOfDay(item.at)
      days.set(day, [...(days.get(day) ?? []), item])
    }
    return [...days.entries()].sort((a, b) => b[0] - a[0]).map(([day, list]) => ({ key: String(day), label: dayLabel(day), items: list }))
  }

  const byArea = new Map<string, ReportItem[]>()
  const areaIds = new Set(areas.map((a) => a.id))
  for (const item of items) {
    const key = groupKeyOf(item, 'area', areaIds, singleDay)
    byArea.set(key, [...(byArea.get(key) ?? []), item])
  }
  const groups: Group[] = [...areas]
    .sort((a, b) => a.order - b.order)
    .filter((a) => byArea.has(a.id))
    .map((a) => ({ key: a.id, label: a.name, items: byArea.get(a.id)! }))
  if (byArea.has('none')) groups.push({ key: 'none', label: 'Everything else', items: byArea.get('none')! })
  // Only one group means no area told anything apart, so a heading would just be noise.
  return groups.length === 1 && groups[0].key === 'none' ? [{ ...groups[0], label: '' }] : groups
}

export interface BehindTheScenes {
  sorted: number
  captured: number
  followUps: number
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** The quiet work that doesn't show up as a finished item, worded for someone else reading the report. */
export function behindTheScenesText(b: BehindTheScenes): string {
  const bits = [
    b.sorted > 0 && `sorted ${plural(b.sorted, 'item', 'items')} into clear next steps`,
    b.captured > 0 && `captured ${plural(b.captured, 'idea', 'ideas')} so nothing got lost`,
    b.followUps > 0 && `followed up ${plural(b.followUps, 'time', 'times')} on things I was waiting for`,
  ].filter(Boolean) as string[]
  if (bits.length === 0) return ''
  const joined = bits.length > 1 ? `${bits.slice(0, -1).join(', ')} and ${bits[bits.length - 1]}` : bits[0]
  return `Also behind the scenes: ${joined}.`
}

export function summaryLine(parts: ReportParts): string {
  const total = totalOf(parts)
  const bits = [`${total} ${total === 1 ? 'thing' : 'things'} finished`]
  if (parts.starred.length > 0) bits.push(`${parts.starred.length} from my Short List`)
  if (parts.projects.length > 0) bits.push(`${parts.projects.length} ${parts.projects.length === 1 ? 'project' : 'projects'} finished`)
  return bits.join(' · ')
}


/** A tidy plain-text version, for pasting into an email or a message. */
export function reportText(args: {
  period: Period
  parts: ReportParts
  groups: Group[]
  mode: GroupMode
  behind: BehindTheScenes | null
}): string {
  const { period, parts, groups, mode, behind } = args
  const multiDay = !isSingleDay(period)
  // Within a week a weekday says enough ("Tue"); across a month it would be ambiguous, so give the date.
  const longStretch = Math.round((period.end - period.start) / 86400000) > 8
  const shortDay = (ts: number) =>
    new Date(ts).toLocaleDateString(undefined, longStretch ? { month: 'short', day: 'numeric' } : { weekday: 'short' })
  const lines: string[] = []
  const item = (i: ReportItem, withDay: boolean) =>
    `• ${i.title}${i.projectTitle ? ` (${i.projectTitle})` : ''}${withDay && multiDay ? ` — ${shortDay(i.at)}` : ''}`

  lines.push(`WHAT I'VE DONE — ${period.label}`, rangeLabel(period), '')
  if (totalOf(parts) === 0) {
    lines.push('Nothing recorded for this period.')
  } else {
    lines.push(summaryLine(parts), '')
    if (parts.starred.length > 0) {
      lines.push('★ Short List', ...parts.starred.map((i) => item(i, true)), '')
    }
    if (parts.projects.length > 0) {
      lines.push('Projects finished', ...parts.projects.map((i) => `• ${i.title}${multiDay ? ` — ${shortDay(i.at)}` : ''}`), '')
    }
    const heading = parts.starred.length > 0 || parts.projects.length > 0 ? 'Also finished' : 'Finished'
    for (const group of groups) {
      lines.push(group.label ? `${heading} — ${group.label}` : heading)
      // Under a day heading the day is already said; under an Area heading it isn't.
      lines.push(...group.items.map((i) => item(i, mode === 'area')), '')
    }
  }
  const b = behind ? behindTheScenesText(behind) : ''
  if (b) lines.push(b)
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  return lines.join('\n')
}
