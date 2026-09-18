import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { db } from '../db/db'
import { captureToInbox } from '../db/operations'
import { TaskRow } from '../components/TaskRow'
import type { ViewKey } from '../components/Sidebar'
import { escapeRegExp, matchSnippet, matchesAll, tokenize } from '../lib/search'
import type { Action, ActionStatus, Project, RecurringTemplate, ReferenceItem } from '../db/types'

const MIN_CHARS = 2
const GROUP_CAP = 25

type GroupKey =
  | 'next'
  | 'projects'
  | 'waiting'
  | 'scheduled'
  | 'someday'
  | 'inbox'
  | 'reference'
  | 'recurring'
  | 'completed'

const GROUP_ORDER: GroupKey[] = [
  'next',
  'projects',
  'waiting',
  'scheduled',
  'someday',
  'inbox',
  'reference',
  'recurring',
  'completed',
]

const GROUP_LABELS: Record<GroupKey, string> = {
  next: 'Next Actions',
  projects: 'Projects',
  waiting: 'Waiting For',
  scheduled: 'Scheduled',
  someday: 'Someday / Maybe',
  inbox: 'Inbox',
  reference: 'Reference',
  recurring: 'Recurring',
  completed: 'Completed',
}

const ACTION_GROUP: Record<Exclude<ActionStatus, 'trash'>, GroupKey> = {
  inbox: 'inbox',
  next: 'next',
  waiting: 'waiting',
  someday: 'someday',
  scheduled: 'scheduled',
  done: 'completed',
}

type ResultItem = { id: string; titleHit: boolean; recency: number } & (
  | { kind: 'action'; action: Action; snippet?: string }
  | { kind: 'project'; project: Project; snippet?: string }
  | { kind: 'reference'; reference: ReferenceItem; snippet?: string }
  | { kind: 'recurring'; template: RecurringTemplate }
)

function emptyGroups(): Record<GroupKey, ResultItem[]> {
  return {
    next: [],
    projects: [],
    waiting: [],
    scheduled: [],
    someday: [],
    inbox: [],
    reference: [],
    recurring: [],
    completed: [],
  }
}

export function SearchView({
  query,
  onQueryChange,
  focusTick,
  onOpenProject,
  onNavigate,
}: {
  query: string
  onQueryChange: (q: string) => void
  focusTick: number
  onOpenProject: (id: string) => void
  onNavigate: (v: ViewKey) => void
}) {
  const actions = useLiveQuery(() => db.actions.toArray())
  const projects = useLiveQuery(() => db.projects.toArray())
  const references = useLiveQuery(() => db.references.toArray())
  const templates = useLiveQuery(() => db.recurringTemplates.toArray())
  const inputRef = useRef<HTMLInputElement>(null)
  const [captured, setCaptured] = useState<string | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [focusTick])

  const trimmed = query.trim()
  const tokens = useMemo(() => tokenize(query), [query])
  const searching = trimmed.length >= MIN_CHARS

  const groups = useMemo(() => {
    if (!searching || !actions || !projects || !references || !templates) return null
    const out = emptyGroups()
    const projectById = new Map(projects.map((p) => [p.id, p]))

    for (const a of actions) {
      if (a.status === 'trash') continue
      const project = a.projectId ? projectById.get(a.projectId) : undefined
      if (!matchesAll(tokens, a.title, a.notes, a.waitingOn, project?.title)) continue
      // Actions inside a parked project aren't engageable, so they live with Someday/Maybe — same rule as the sidebar counts.
      const key = a.status !== 'done' && project?.status === 'someday' ? 'someday' : ACTION_GROUP[a.status]
      const titleHit = matchesAll(tokens, a.title)
      out[key].push({
        kind: 'action',
        id: a.id,
        action: a,
        snippet: titleHit ? undefined : matchSnippet(tokens, [a.notes]),
        titleHit,
        recency: a.completedAt ?? a.touchedAt ?? a.createdAt,
      })
    }

    for (const p of projects) {
      const planning = p.planning
      const details = [p.outcome, planning?.purpose, planning?.brainstorm, planning?.organized]
      if (!matchesAll(tokens, p.title, ...details)) continue
      const key: GroupKey = p.status === 'active' ? 'projects' : p.status === 'someday' ? 'someday' : 'completed'
      out[key].push({
        kind: 'project',
        id: p.id,
        project: p,
        snippet: matchSnippet(tokens, details),
        titleHit: matchesAll(tokens, p.title),
        recency: p.completedAt ?? p.createdAt,
      })
    }

    for (const r of references) {
      if (!matchesAll(tokens, r.title, r.content, r.url)) continue
      out.reference.push({
        kind: 'reference',
        id: r.id,
        reference: r,
        snippet: matchSnippet(tokens, [r.content, r.url]),
        titleHit: matchesAll(tokens, r.title),
        recency: r.createdAt,
      })
    }

    for (const t of templates) {
      if (!matchesAll(tokens, t.title)) continue
      out.recurring.push({ kind: 'recurring', id: t.id, template: t, titleHit: true, recency: t.createdAt })
    }

    for (const key of GROUP_ORDER) {
      out[key].sort((a, b) => Number(b.titleHit) - Number(a.titleHit) || b.recency - a.recency)
    }
    return out
  }, [searching, tokens, actions, projects, references, templates])

  const total = groups ? GROUP_ORDER.reduce((n, k) => n + groups[k].length, 0) : 0

  const captureQuery = () => {
    void captureToInbox(trimmed)
    setCaptured(trimmed)
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-1 text-xl font-semibold text-neutral-100">Search</h1>
      <p className="mb-4 text-sm text-neutral-500">
        Find anything you've captured — actions, projects, Someday/Maybe, Reference, and recurring items.
      </p>

      <input
        ref={inputRef}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onQueryChange('')
        }}
        placeholder="Type to search…"
        className="mb-6 w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-emerald-600"
      />

      {!searching && (
        <p className="text-sm text-neutral-600">Type at least {MIN_CHARS} letters to start searching.</p>
      )}

      {groups && total === 0 && (
        <div className="rounded-lg border border-dashed border-neutral-800 p-8 text-center">
          <p className="mb-3 text-sm text-neutral-500">Nothing found for "{trimmed}".</p>
          {captured === trimmed ? (
            <p className="text-sm text-emerald-400">Captured to your Inbox.</p>
          ) : (
            <button
              onClick={captureQuery}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
            >
              Capture "{trimmed}" to Inbox
            </button>
          )}
        </div>
      )}

      {groups && total > 0 && (
        <p className="mb-4 text-xs text-neutral-600">
          {total} result{total === 1 ? '' : 's'}
        </p>
      )}

      {groups &&
        GROUP_ORDER.filter((key) => groups[key].length > 0).map((key) => {
          const items = groups[key]
          const shown = items.slice(0, GROUP_CAP)
          return (
            <section key={key} className={`mb-6 ${key === 'completed' ? 'opacity-60' : ''}`}>
              <h2 className="mb-1 px-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
                {GROUP_LABELS[key]} <span className="text-neutral-600">{items.length}</span>
              </h2>
              <div className="flex flex-col divide-y divide-neutral-900">
                {shown.map((item) => (
                  <ResultRow
                    key={item.id}
                    item={item}
                    tokens={tokens}
                    onOpenProject={onOpenProject}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
              {items.length > shown.length && (
                <p className="mt-1 px-3 text-xs text-neutral-600">
                  +{items.length - shown.length} more — keep typing to narrow it down.
                </p>
              )}
            </section>
          )
        })}
    </div>
  )
}

function ResultRow({
  item,
  tokens,
  onOpenProject,
  onNavigate,
}: {
  item: ResultItem
  tokens: string[]
  onOpenProject: (id: string) => void
  onNavigate: (v: ViewKey) => void
}) {
  if (item.kind === 'action') {
    return (
      <div>
        <TaskRow action={item.action} showProject onOpenProject={onOpenProject} />
        {item.snippet && (
          <div className="truncate pb-2 pl-11 pr-3 text-xs text-neutral-500">
            in notes: <Highlight text={item.snippet} tokens={tokens} />
          </div>
        )}
      </div>
    )
  }

  if (item.kind === 'project') {
    const { project, snippet } = item
    return (
      <button
        onClick={() => onOpenProject(project.id)}
        className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left hover:bg-neutral-900"
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-sm" title="Project">
          📁
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm text-neutral-100">
            <Highlight text={project.title} tokens={tokens} />
            {project.status !== 'active' && (
              <span className="ml-2 rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">
                {project.status}
              </span>
            )}
          </div>
          {snippet && (
            <div className="mt-0.5 truncate text-xs text-neutral-500">
              <Highlight text={snippet} tokens={tokens} />
            </div>
          )}
        </div>
      </button>
    )
  }

  if (item.kind === 'reference') {
    const { reference, snippet } = item
    return (
      <button
        onClick={() => onNavigate('reference')}
        className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left hover:bg-neutral-900"
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-sm" title="Reference">
          📎
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm text-neutral-100">
            <Highlight text={reference.title} tokens={tokens} />
          </div>
          {snippet && (
            <div className="mt-0.5 truncate text-xs text-neutral-500">
              <Highlight text={snippet} tokens={tokens} />
            </div>
          )}
        </div>
      </button>
    )
  }

  return (
    <button
      onClick={() => onNavigate('recurring')}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-neutral-900"
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-sm" title="Recurring">
        🔁
      </span>
      <span className="truncate text-sm text-neutral-100">
        <Highlight text={item.template.title} tokens={tokens} />
      </span>
    </button>
  )
}

function Highlight({ text, tokens }: { text: string; tokens: string[] }) {
  if (!tokens.length) return <>{text}</>
  const parts = text.split(new RegExp(`(${tokens.map(escapeRegExp).join('|')})`, 'gi'))
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded bg-emerald-500/30 px-0.5 text-inherit">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  )
}
