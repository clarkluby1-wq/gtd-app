import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { db } from '../db/db'
import {
  recentProjectIds,
  searchProjects,
  sortAlphabetically,
  suggestProjects,
  type PickerProject,
} from '../lib/projectPicker'

interface Row {
  /** undefined is the "No project" row. */
  id: string | undefined
  title: string
  tag?: string
}

interface Section {
  label?: string
  rows: Row[]
}

/**
 * Choose which project something belongs to, without facing the whole list. It opens on a few likely picks (projects
 * whose names share words with the task, and the ones you've used lately); type to search the rest, or browse
 * everything alphabetically if you'd rather scroll. Finished and dropped projects never appear; Someday ones only
 * turn up when you search for them.
 */
export function ProjectPicker({
  value,
  onChange,
  title,
}: {
  value: string | undefined
  onChange: (id: string | undefined) => void
  /** The task's own title, used to suggest projects. */
  title: string
}) {
  const projects = useLiveQuery(() => db.projects.where('status').anyOf('active', 'someday').toArray())
  const recentIds = useLiveQuery(async () => recentProjectIds(await db.actions.filter((a) => !!a.projectId).toArray(), 8))
  // Looked up by id on its own: the chosen project may be one the list no longer offers (finished, say), and must still show its name.
  const chosen = useLiveQuery(() => (value ? db.projects.get(value) : undefined), [value])

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [browseAll, setBrowseAll] = useState(false)
  const [cursor, setCursor] = useState(0)

  const sections: Section[] = useMemo(() => {
    const all: PickerProject[] = projects ?? []
    const active = all.filter((p) => p.status === 'active')
    const toRow = (p: PickerProject): Row => ({
      id: p.id,
      title: p.title,
      tag: p.status === 'someday' ? '🌙 Someday' : undefined,
    })

    if (query.trim()) return [{ label: 'Matches', rows: searchProjects(query, all).map(toRow) }]
    if (browseAll) return [{ label: `All ${active.length} projects`, rows: sortAlphabetically(active).map(toRow) }]

    const suggested = suggestProjects(title, all)
    const suggestedIds = new Set(suggested.map((p) => p.id))
    const byId = new Map(active.map((p) => [p.id, p]))
    const recent = (recentIds ?? [])
      .map((id) => byId.get(id))
      .filter((p): p is PickerProject => p !== undefined && !suggestedIds.has(p.id))
      .slice(0, 4)

    return [
      { rows: [{ id: undefined, title: 'No project' }] },
      ...(suggested.length ? [{ label: 'Suggested', rows: suggested.map(toRow) }] : []),
      ...(recent.length ? [{ label: 'Recent', rows: recent.map(toRow) }] : []),
    ]
  }, [projects, recentIds, query, browseAll, title])

  const flat = sections.flatMap((s) => s.rows)
  const activeCount = projects?.filter((p) => p.status === 'active').length ?? 0

  const close = () => {
    setOpen(false)
    setQuery('')
    setBrowseAll(false)
    setCursor(0)
  }
  const pick = (id: string | undefined) => {
    onChange(id)
    close()
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-left text-sm outline-none hover:border-neutral-600"
      >
        <span className={`min-w-0 flex-1 truncate ${chosen ? 'text-neutral-100' : 'text-neutral-400'}`}>
          {chosen?.title ?? 'No project'}
        </span>
        <span className="shrink-0 text-xs text-neutral-500" aria-hidden>
          ▾
        </span>
      </button>
    )
  }

  let index = -1
  return (
    <div className="rounded-md border border-neutral-600 bg-neutral-800">
      <input
        autoFocus
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setCursor(0)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setCursor((c) => Math.min(c + 1, Math.max(flat.length - 1, 0)))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setCursor((c) => Math.max(c - 1, 0))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            if (flat[cursor]) pick(flat[cursor].id)
          } else if (e.key === 'Escape') {
            e.preventDefault()
            e.stopPropagation()
            close()
          }
        }}
        placeholder={activeCount > 0 ? `Search your ${activeCount} projects…` : 'Search your projects…'}
        className="w-full rounded-t-md border-b border-neutral-700 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-neutral-500"
      />

      <div className="max-h-56 overflow-y-auto py-1">
        {sections.map((section, i) => (
          <div key={section.label ?? `s${i}`}>
            {section.label && (
              <div className="px-3 pb-0.5 pt-2 text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                {section.label}
              </div>
            )}
            {section.rows.map((row) => {
              index += 1
              const at = index
              const selected = row.id === value
              return (
                <button
                  type="button"
                  key={row.id ?? 'none'}
                  onClick={() => pick(row.id)}
                  onMouseEnter={() => setCursor(at)}
                  className={`flex w-full items-start justify-between gap-3 px-3 py-1.5 text-left text-sm ${
                    at === cursor ? 'bg-neutral-700' : ''
                  } ${row.id === undefined ? 'text-neutral-400' : 'text-neutral-100'}`}
                >
                  <span className="min-w-0 flex-1 break-words">{row.title}</span>
                  <span className="shrink-0 text-xs text-neutral-500">
                    {row.tag}
                    {selected && <span className="ml-2 text-emerald-400">✓</span>}
                  </span>
                </button>
              )
            })}
          </div>
        ))}

        {query.trim() && flat.length === 0 && (
          <p className="px-3 py-2 text-sm text-neutral-500">No project matches “{query.trim()}”.</p>
        )}
        {!query.trim() && !browseAll && activeCount === 0 && (
          <p className="px-3 py-2 text-sm text-neutral-500">No projects yet.</p>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-neutral-700 px-3 py-1.5 text-xs text-neutral-500">
        {!query.trim() && !browseAll && activeCount > 0 ? (
          <button type="button" onClick={() => setBrowseAll(true)} className="hover:text-neutral-300">
            Browse all {activeCount} ▸
          </button>
        ) : browseAll && !query.trim() ? (
          <button type="button" onClick={() => setBrowseAll(false)} className="hover:text-neutral-300">
            ◂ Back to suggestions
          </button>
        ) : (
          <span />
        )}
        <button type="button" onClick={close} className="hover:text-neutral-300">
          Close
        </button>
      </div>
    </div>
  )
}
