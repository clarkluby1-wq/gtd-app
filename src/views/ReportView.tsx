import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { db } from '../db/db'
import { TaskRow } from '../components/TaskRow'
import { reopenAction } from '../db/operations'
import { startOfToday } from '../lib/date'
import {
  PERIODS,
  behindTheScenesText,
  buildItems,
  groupItems,
  groupKeyOf,
  isSingleDay,
  partsOf,
  periodFor,
  rangeLabel,
  reportText,
  summaryLine,
  totalOf,
  withProjectSteps,
  type BehindTheScenes,
  type Group,
  type GroupMode,
  type Period,
  type PeriodKey,
  type ReportItem,
  type ReportParts,
} from '../lib/report'
import { useSomedayProjectIds } from '../lib/useSomedayProjectIds'

const OTHERS_PREVIEW = 10

const timeOf = (ts: number) => new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
const dateOf = (ts: number) => new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
const whenOf = (ts: number, withDate: boolean) => (withDate ? `${dateOf(ts)} · ${timeOf(ts)}` : timeOf(ts))

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Older or stricter browsers: fall back to a hidden text box.
    const box = document.createElement('textarea')
    box.value = text
    box.style.position = 'fixed'
    box.style.opacity = '0'
    document.body.appendChild(box)
    box.select()
    const ok = document.execCommand('copy')
    box.remove()
    return ok
  }
}

/**
 * "What I've Done": everything you finished over a stretch of time, made to feel good to open and easy to show
 * someone. Today is live (with your Short List); every period can be printed, copied as text, or shown as a clean
 * page — and anything you'd rather keep private can be left out first. It only ever describes what got done.
 */
export function ReportView({
  onOpenProject,
  onViewNextActions,
}: {
  onOpenProject: (projectId: string) => void
  onViewNextActions: () => void
}) {
  const [periodKey, setPeriodKey] = useState<PeriodKey>('today')
  const [mode, setMode] = useState<GroupMode>('day')
  const [choosing, setChoosing] = useState(false)
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [showBehind, setShowBehind] = useState(true)
  const [showAll, setShowAll] = useState(false)
  const [sheet, setSheet] = useState<null | { print: boolean }>(null)
  const [copied, setCopied] = useState(false)
  const somedayProjectIds = useSomedayProjectIds()

  const period = periodFor(periodKey)
  const singleDay = isSingleDay(period)
  const isToday = periodKey === 'today'
  const today = startOfToday()
  const { start, end } = period

  const doneActions = useLiveQuery(
    () =>
      db.actions
        .where('status')
        .equals('done')
        .filter((a) => a.completedAt !== undefined && a.completedAt >= start && a.completedAt < end)
        .toArray(),
    [start, end],
  )
  const finishedProjects = useLiveQuery(
    () =>
      db.projects
        .where('status')
        .equals('completed')
        .filter((p) => p.completedAt !== undefined && p.completedAt >= start && p.completedAt < end)
        .toArray(),
    [start, end],
  )
  const projects = useLiveQuery(() => db.projects.toArray())
  const areas = useLiveQuery(() => db.areasOfFocus.orderBy('order').toArray())
  const shortLeftRaw = useLiveQuery(
    () => (isToday ? db.actions.where('status').equals('next').filter((a) => a.bigThreeDate === today).toArray() : []),
    [isToday, today],
  )
  const behind = useLiveQuery(async (): Promise<BehindTheScenes> => {
    const captured = await db.captureEvents.where('createdAt').between(start, end, true, false).count()
    const all = await db.actions.toArray()
    return {
      captured,
      // Sorted out of the Inbox: clarified after it was captured (things made straight into a project step don't count).
      sorted: all.filter((a) => a.clarifiedAt !== undefined && a.clarifiedAt > a.createdAt && a.clarifiedAt >= start && a.clarifiedAt < end).length,
      followUps: all.reduce((n, a) => n + (a.followUps ?? []).filter((t) => t >= start && t < end).length, 0),
    }
  }, [start, end])

  const items = useMemo(
    () =>
      doneActions && finishedProjects && projects
        ? buildItems({ actions: doneActions, finishedProjects, projects, period: { key: periodKey, label: '', start, end } })
        : [],
    [doneActions, finishedProjects, projects, periodKey, start, end],
  )
  const areaList = useMemo(() => areas ?? [], [areas])

  // What gets printed, copied and shown: everything except what you unticked.
  const parts = useMemo(() => partsOf(items, excluded), [items, excluded])
  const sheetGroups = groupItems(parts.others, mode, areaList, singleDay)
  const behindForReport = showBehind ? (behind ?? null) : null

  const closeSheet = useCallback(() => setSheet(null), [])

  if (!doneActions || !finishedProjects || !projects || !areas || !behind) return null

  // What you see here is everything; the ticks only decide what leaves the app.
  const allStarred = items.filter((i) => i.kind === 'action' && i.starred)
  const allProjects = items.filter((i) => i.kind === 'project')
  const allOthers = items.filter((i) => i.kind === 'action' && !i.starred)
  const visibleOthers = choosing || showAll ? allOthers : allOthers.slice(0, OTHERS_PREVIEW)
  const screenGroups = groupItems(visibleOthers, mode, areaList, singleDay)

  const shortLeft = (shortLeftRaw ?? [])
    .filter((a) => !a.projectId || !somedayProjectIds.has(a.projectId))
    .sort((a, b) => a.order - b.order)
  const won = [...allStarred].reverse() // the day's order, for the live Short List
  const shortTotal = won.length + shortLeft.length
  const allWon = shortTotal > 0 && shortLeft.length === 0

  const areaIds = new Set(areaList.map((a) => a.id))
  const areaNameOf = (i: ReportItem) => areaList.find((a) => a.id === i.areaId)?.name
  // A group's "all / none" covers everything that belongs to it, not just the rows listed under its heading.
  const idsOfGroup = (g: Group) => items.filter((i) => groupKeyOf(i, mode, areaIds, singleDay) === g.key).map((i) => i.id)

  const totalDone = items.length
  const leftOut = items.filter((i) => excluded.has(i.id)).length
  const nothingToShare = totalOf(parts) === 0

  // Ticking or unticking a finished project takes its steps with it (see withProjectSteps).
  const toggle = (id: string) =>
    setExcluded((prev) => {
      const next = new Set(prev)
      const nowIncluded = next.has(id)
      for (const each of withProjectSteps([id], items)) {
        if (nowIncluded) next.delete(each)
        else next.add(each)
      }
      return next
    })
  const setMany = (ids: string[], include: boolean) =>
    setExcluded((prev) => {
      const next = new Set(prev)
      for (const id of withProjectSteps(ids, items)) {
        if (include) next.delete(id)
        else next.add(id)
      }
      return next
    })

  const copy = async () => {
    const ok = await copyToClipboard(reportText({ period: { ...period, label: PERIODS.find((p) => p.key === periodKey)!.label }, parts, groups: sheetGroups, mode, behind: behindForReport }))
    setCopied(ok)
    setTimeout(() => setCopied(false), 2000)
  }

  const label = PERIODS.find((p) => p.key === periodKey)!.label
  const fullPeriod: Period = { ...period, label }
  const calmMessage = isToday
    ? "Nothing checked off yet — the day isn't over. Even one small thing counts."
    : periodKey === 'yesterday'
      ? 'A quiet day. Rest counts too.'
      : 'A lighter stretch. Rest counts too.'

  const bits = behind
    ? [
        behind.sorted > 0 && `sorted ${behind.sorted} ${behind.sorted === 1 ? 'thing' : 'things'} into a clear next step`,
        behind.captured > 0 && `captured ${behind.captured} so they weren't rattling around in your head`,
        behind.followUps > 0 && `followed up ${behind.followUps} ${behind.followUps === 1 ? 'time' : 'times'} on things you were waiting for`,
      ].filter(Boolean)
    : []

  const buttonClass = 'rounded-md bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-1 text-xl font-semibold text-neutral-100">What I've Done</h1>
      <p className="mb-4 text-sm text-neutral-500">{rangeLabel(period)}. What you've moved forward.</p>

      <div role="tablist" aria-label="Time period" className="mb-4 flex flex-wrap gap-1.5">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            role="tab"
            aria-selected={p.key === periodKey}
            onClick={() => {
              setPeriodKey(p.key)
              setShowAll(false)
            }}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              p.key === periodKey ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-1.5 text-xs text-neutral-500">
          <span>Group by</span>
          {(['day', 'area'] as GroupMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`rounded-md px-2.5 py-1 text-xs ${mode === m ? 'bg-neutral-700 text-neutral-100' : 'text-neutral-400 hover:text-neutral-200'}`}
            >
              {m === 'day' ? 'Day' : 'Area'}
            </button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button onClick={() => setChoosing((v) => !v)} className={buttonClass} aria-pressed={choosing}>
            {choosing ? 'Done choosing' : 'Choose what to include'}
          </button>
          <button onClick={() => setSheet({ print: false })} disabled={nothingToShare} className={buttonClass} title="A clean page, with none of the app around it">
            Show someone
          </button>
          <button onClick={() => setSheet({ print: true })} disabled={nothingToShare} className={buttonClass}>
            Print / Save as PDF
          </button>
          <button onClick={() => void copy()} disabled={nothingToShare} className={buttonClass}>
            {copied ? '✓ Copied' : 'Copy as text'}
          </button>
        </div>
      </div>

      {choosing && (
        <div className="mb-5 rounded-lg border border-emerald-900/50 bg-emerald-950/20 p-3 text-xs text-neutral-300">
          <p>
            Untick anything you'd rather leave out. It stays safely in the app — it just won't appear in what you print,
            copy or show. Leaving out a finished project leaves out its steps too; you can tick any step back in.
          </p>
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-neutral-400">
            <input
              type="checkbox"
              checked={showBehind}
              onChange={(e) => setShowBehind(e.target.checked)}
              className="h-4 w-4 accent-emerald-600"
            />
            Include the "behind the scenes" line (sorting, capturing, following up)
          </label>
        </div>
      )}
      {!choosing && leftOut > 0 && (
        <p className="mb-4 text-xs text-neutral-500">
          {leftOut} left out of what you print, copy or show.{' '}
          <button onClick={() => setExcluded(new Set())} className="text-emerald-400 hover:text-emerald-300">
            Include everything
          </button>
        </p>
      )}

      <div className="mb-6 flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border border-neutral-800 bg-neutral-900 px-5 py-4">
        {totalDone > 0 ? (
          <>
            <span className="text-4xl font-semibold text-emerald-400">{totalDone}</span>
            <span className="text-sm text-neutral-300">{totalDone === 1 ? 'thing finished' : 'things finished'}</span>
            {allStarred.length > 0 && <span className="text-sm text-amber-300">★ {allStarred.length} from your Short List</span>}
            {allProjects.length > 0 && (
              <span className="text-sm text-neutral-400">
                🏁 {allProjects.length} {allProjects.length === 1 ? 'project' : 'projects'} finished
              </span>
            )}
          </>
        ) : (
          <p className="text-sm text-neutral-400">{calmMessage}</p>
        )}
      </div>

      {isToday ? (
        <section
          className={`mb-6 rounded-lg border p-4 ${allWon ? 'border-amber-500/50 bg-amber-500/10' : 'border-neutral-800 bg-neutral-900'}`}
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-neutral-300">Today's Short List</h2>
            {shortTotal > 0 && (
              <span className="flex items-center gap-2 text-xs text-neutral-400">
                <span className="text-base tracking-wide text-amber-400" aria-hidden>
                  {'★'.repeat(won.length)}
                  <span className="text-neutral-600">{'☆'.repeat(shortLeft.length)}</span>
                </span>
                {won.length} of {shortTotal} done
              </span>
            )}
          </div>

          {shortTotal === 0 ? (
            <p className="text-sm text-neutral-500">
              Nothing on today's Short List.{' '}
              <button onClick={onViewNextActions} className="text-emerald-400 hover:text-emerald-300">
                Pick up to three from Next Actions →
              </button>
            </p>
          ) : (
            <>
              {allWon && (
                <p className="mb-3 text-sm font-medium text-amber-300">
                  ✓ Short List complete — the things that mattered most today are done.
                </p>
              )}
              {won.length > 0 && (
                <div className="flex flex-col gap-2">
                  {won.map((i) => (
                    <WonRow key={i.id} item={i} when={whenOf(i.at, false)} area={mode === 'area' ? areaNameOf(i) : undefined} choosing={choosing} included={!excluded.has(i.id)} onToggle={() => toggle(i.id)} />
                  ))}
                </div>
              )}
              {shortLeft.length > 0 && (
                <div className={won.length > 0 ? 'mt-4' : ''}>
                  <div className="mb-1 text-xs font-medium text-neutral-500">Still on your list</div>
                  <div className="flex flex-col divide-y divide-neutral-900">
                    {shortLeft.map((a) => (
                      <TaskRow key={a.id} action={a} showProject onOpenProject={onOpenProject} />
                    ))}
                  </div>
                  <p className="mt-2 px-3 text-xs text-neutral-600">
                    Whatever's left is safe in Next Actions — it just stops being pinned at midnight.
                  </p>
                </div>
              )}
            </>
          )}
        </section>
      ) : allStarred.length > 0 ? (
        <section className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="mb-3 flex items-baseline gap-3">
            <span className="text-2xl font-semibold text-amber-300">★ {allStarred.length}</span>
            <span className="text-sm text-neutral-300">from your Short List — the things you said mattered most</span>
          </div>
          <div className="flex flex-col gap-2">
            {allStarred.map((i) => (
              <WonRow key={i.id} item={i} when={whenOf(i.at, true)} area={mode === 'area' ? areaNameOf(i) : undefined} choosing={choosing} included={!excluded.has(i.id)} onToggle={() => toggle(i.id)} />
            ))}
          </div>
        </section>
      ) : (
        <p className="mb-6 text-xs text-neutral-500">
          Star up to three things each day and they'll gather here — proof of what you decided mattered most.
        </p>
      )}

      {(allProjects.length > 0 || allOthers.length > 0) && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-medium text-neutral-300">
            {allStarred.length > 0 ? 'Also finished' : 'Finished'}
          </h2>

          {allProjects.length > 0 && (
            <div className="mb-3 flex flex-col divide-y divide-neutral-900 rounded-lg border border-neutral-900">
              {allProjects.map((i) => (
                <DoneRow key={i.id} item={i} when={whenOf(i.at, !singleDay)} area={mode === 'area' ? areaNameOf(i) : undefined} choosing={choosing} included={!excluded.has(i.id)} onToggle={() => toggle(i.id)} />
              ))}
            </div>
          )}

          {screenGroups.map((g) => (
            <GroupBlock key={g.key} group={g} ids={idsOfGroup(g)} choosing={choosing} excluded={excluded} onSetMany={setMany}>
              {g.items.map((i) => (
                <DoneRow
                  key={i.id}
                  item={i}
                  when={whenOf(i.at, mode === 'area' && !singleDay)}
                  choosing={choosing}
                  included={!excluded.has(i.id)}
                  onToggle={() => toggle(i.id)}
                />
              ))}
            </GroupBlock>
          ))}

          {!choosing && allOthers.length > OTHERS_PREVIEW && (
            <button onClick={() => setShowAll((v) => !v)} className="mt-2 text-xs text-neutral-500 hover:text-neutral-300">
              {showAll ? 'Show fewer' : `Show all ${allOthers.length}`}
            </button>
          )}
        </section>
      )}

      {bits.length > 0 && (
        <p className="text-xs text-neutral-500">
          You also {bits.length > 1 ? `${bits.slice(0, -1).join(', ')} and ${bits[bits.length - 1]}` : bits[0]}.
        </p>
      )}

      {sheet && (
        <ReportSheet
          period={fullPeriod}
          parts={parts}
          groups={sheetGroups}
          mode={mode}
          singleDay={singleDay}
          behind={behindForReport}
          copied={copied}
          onCopy={() => void copy()}
          onClose={closeSheet}
          autoPrint={sheet.print}
        />
      )}
    </div>
  )
}

/** One heading and its rows. While choosing, the heading offers "all · none" for the whole group. */
function GroupBlock({
  group,
  ids,
  choosing,
  excluded,
  onSetMany,
  children,
}: {
  group: Group
  /** Everything this group stands for, including Short List wins and finished projects listed elsewhere. */
  ids: string[]
  choosing: boolean
  excluded: Set<string>
  onSetMany: (ids: string[], include: boolean) => void
  children: React.ReactNode
}) {
  return (
    <div className="mb-3">
      {(group.label || choosing) && (
        <div className="mb-1 flex items-center justify-between gap-3">
          <div className="text-xs font-medium text-sky-400">{group.label}</div>
          {choosing && (
            <div className="flex gap-2 text-xs text-neutral-500">
              <button onClick={() => onSetMany(ids, true)} className="hover:text-neutral-200" disabled={ids.every((id) => !excluded.has(id))}>
                all
              </button>
              <span aria-hidden>·</span>
              <button onClick={() => onSetMany(ids, false)} className="hover:text-neutral-200" disabled={ids.every((id) => excluded.has(id))}>
                none
              </button>
            </div>
          )}
        </div>
      )}
      <div className="flex flex-col divide-y divide-neutral-900 rounded-lg border border-neutral-900">{children}</div>
    </div>
  )
}

function Tick({ included, onToggle, title }: { included: boolean; onToggle: () => void; title: string }) {
  return (
    <input
      type="checkbox"
      checked={included}
      onChange={onToggle}
      aria-label={`Include “${title}” in the report`}
      className="h-4 w-4 shrink-0 accent-emerald-600"
    />
  )
}

function DoneRow({
  item,
  when,
  area,
  choosing,
  included,
  onToggle,
}: {
  item: ReportItem
  when: string
  /** Shown when the report is grouped by Area, for rows that sit outside an area group. */
  area?: string
  choosing: boolean
  included: boolean
  onToggle: () => void
}) {
  return (
    <div className={`group flex items-center gap-3 px-3 py-2 text-sm ${choosing && !included ? 'opacity-40' : ''}`}>
      {choosing && <Tick included={included} onToggle={onToggle} title={item.title} />}
      <span className="shrink-0 text-emerald-500" aria-hidden>
        {item.kind === 'project' ? '🏁' : '✓'}
      </span>
      <div className="min-w-0 flex-1">
        <div className="break-words text-neutral-100">{item.kind === 'project' ? `Project finished: ${item.title}` : item.title}</div>
        {(item.projectTitle || area) && (
          <div className="text-xs text-neutral-500">
            {item.projectTitle && `↳ ${item.projectTitle}`}
            {item.projectTitle && area && ' · '}
            {area}
          </div>
        )}
      </div>
      <span className="shrink-0 text-xs text-neutral-500">{when}</span>
      {!choosing && item.kind === 'action' && (
        <button
          onClick={() => void reopenAction(item.id)}
          title="Mark it not done"
          className="shrink-0 text-xs text-neutral-600 opacity-0 hover:text-neutral-300 group-hover:opacity-100 focus:opacity-100"
        >
          Undo
        </button>
      )}
    </div>
  )
}

/** A Short List item that got done: bright, starred, and unmissable — this is the feeling the list is for. */
function WonRow({
  item,
  when,
  area,
  choosing,
  included,
  onToggle,
}: {
  item: ReportItem
  when: string
  area?: string
  choosing: boolean
  included: boolean
  onToggle: () => void
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border border-amber-500/40 bg-gradient-to-r from-amber-500/20 to-amber-500/5 px-4 py-3 ${
        choosing && !included ? 'opacity-40' : ''
      }`}
    >
      {choosing && <Tick included={included} onToggle={onToggle} title={item.title} />}
      <span className="text-2xl leading-none text-amber-300" aria-hidden>
        ★
      </span>
      <div className="min-w-0 flex-1">
        <div className="break-words text-sm font-semibold text-amber-50">{item.title}</div>
        <div className="mt-0.5 text-xs text-amber-200/70">
          Done {when.includes('·') ? when : `at ${when}`}
          {item.projectTitle ? ` · ${item.projectTitle}` : ''}
          {area ? ` · ${area}` : ''}
        </div>
      </div>
      {!choosing && (
        <button
          onClick={() => void reopenAction(item.id)}
          title="Mark it not done"
          className="shrink-0 text-xs text-amber-200/60 hover:text-amber-100"
        >
          Undo
        </button>
      )}
    </div>
  )
}

/**
 * The report as a clean, light page — for showing on screen or printing. It's drawn straight onto the page body, and
 * the print styles hide everything else, so the paper copy is just this. Anything you unticked is already left out.
 */
function ReportSheet({
  period,
  parts,
  groups,
  mode,
  singleDay,
  behind,
  copied,
  onCopy,
  onClose,
  autoPrint,
}: {
  period: Period
  parts: ReportParts
  groups: Group[]
  mode: GroupMode
  singleDay: boolean
  behind: BehindTheScenes | null
  copied: boolean
  onCopy: () => void
  onClose: () => void
  autoPrint: boolean
}) {
  useEffect(() => {
    // Keep keyboard focus on the page while it's up.
    const root = document.getElementById('root')
    root?.setAttribute('inert', '')
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      root?.removeAttribute('inert')
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  useEffect(() => {
    if (!autoPrint) return
    const timer = setTimeout(() => window.print(), 250)
    return () => clearTimeout(timer)
  }, [autoPrint])

  const total = totalOf(parts)
  const behindLine = behind ? behindTheScenesText(behind) : ''
  const hasHighlights = parts.starred.length > 0 || parts.projects.length > 0
  const barButton = 'rounded-md border border-neutral-400 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-100'
  const rowDate = (ts: number, withDate: boolean) => (withDate && !singleDay ? new Date(ts).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : '')

  const Row = ({ item, withDate }: { item: ReportItem; withDate: boolean }) => (
    <li className="report-row flex items-baseline gap-3 border-b border-neutral-200 py-1.5 text-sm">
      <span className="shrink-0 text-neutral-400" aria-hidden>
        ✓
      </span>
      <span className="min-w-0 flex-1 break-words">
        {item.title}
        {item.projectTitle && <span className="text-neutral-500"> — {item.projectTitle}</span>}
      </span>
      <span className="shrink-0 text-xs text-neutral-500">{rowDate(item.at, withDate)}</span>
    </li>
  )

  return createPortal(
    <div
      id="report-sheet-root"
      role="dialog"
      aria-modal="true"
      aria-label={`What I've done: ${period.label}`}
      className="fixed inset-0 z-[70] overflow-y-auto bg-neutral-300 text-neutral-900"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-neutral-400 bg-neutral-200/95 px-4 py-2 print:hidden">
        <span className="text-xs text-neutral-600">This is how it will look on paper.</span>
        <div className="flex items-center gap-2">
          <button onClick={onCopy} className={barButton}>
            {copied ? '✓ Copied' : 'Copy as text'}
          </button>
          <button onClick={() => window.print()} className={barButton}>
            Print / Save as PDF
          </button>
          <button autoFocus onClick={onClose} className={barButton}>
            ✕ Close
          </button>
        </div>
      </div>

      <article className="report-paper mx-auto my-6 w-full max-w-[8.5in] bg-white px-10 py-10 text-neutral-900 shadow-lg print:my-0 print:shadow-none">
        <header className="report-heading mb-6 border-b border-neutral-300 pb-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">What I've done</p>
          <h1 className="mt-1 text-3xl font-semibold">{period.label}</h1>
          <p className="mt-1 text-sm text-neutral-600">{rangeLabel(period)}</p>
        </header>

        {total === 0 ? (
          <p className="text-sm text-neutral-600">Nothing recorded for this period.</p>
        ) : (
          <>
            <p className="report-heading mb-6 text-lg font-medium">{summaryLine(parts)}</p>

            {parts.starred.length > 0 && (
              <section className="mb-6">
                <h2 className="report-heading mb-1 text-sm font-semibold uppercase tracking-wide text-amber-700">★ Short List</h2>
                <ul>
                  {parts.starred.map((i) => (
                    <Row key={i.id} item={i} withDate />
                  ))}
                </ul>
              </section>
            )}

            {parts.projects.length > 0 && (
              <section className="mb-6">
                <h2 className="report-heading mb-1 text-sm font-semibold uppercase tracking-wide text-neutral-700">Projects finished</h2>
                <ul>
                  {parts.projects.map((i) => (
                    <Row key={i.id} item={i} withDate />
                  ))}
                </ul>
              </section>
            )}

            {groups.map((g) => (
              <section key={g.key} className="mb-6">
                <h2 className="report-heading mb-1 text-sm font-semibold uppercase tracking-wide text-neutral-700">
                  {g.label ? `${hasHighlights ? 'Also finished' : 'Finished'} — ${g.label}` : hasHighlights ? 'Also finished' : 'Finished'}
                </h2>
                <ul>
                  {g.items.map((i) => (
                    <Row key={i.id} item={i} withDate={mode === 'area'} />
                  ))}
                </ul>
              </section>
            ))}
          </>
        )}

        {behindLine && <p className="mb-6 text-sm text-neutral-600">{behindLine}</p>}

        <footer className="mt-8 border-t border-neutral-200 pt-3 text-xs text-neutral-400">
          Prepared {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </footer>
      </article>
    </div>,
    document.body,
  )
}
