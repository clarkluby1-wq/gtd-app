import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db/db'
import { createReference, deleteReference, updateReference } from '../db/reference'
import type { ReferenceItem } from '../db/types'

export function ReferenceView() {
  const items = useLiveQuery(() => db.references.orderBy('createdAt').reverse().toArray())
  const projects = useLiveQuery(() => db.projects.toArray())
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [url, setUrl] = useState('')
  const [query, setQuery] = useState('')

  const create = async () => {
    if (!title.trim()) return
    await createReference({ title: title.trim(), content: content.trim() || undefined, url: url.trim() || undefined })
    setTitle('')
    setContent('')
    setUrl('')
    setCreating(false)
  }

  const filtered = items?.filter(
    (i) =>
      !query.trim() ||
      i.title.toLowerCase().includes(query.toLowerCase()) ||
      i.content?.toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-100">Reference</h1>
        <button
          onClick={() => setCreating((v) => !v)}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
        >
          + Add
        </button>
      </div>
      <p className="mb-4 text-sm text-neutral-500">
        Non-actionable material worth keeping — notes, links, decisions. Not a to-do list.
      </p>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search reference material…"
        className="mb-4 w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none"
      />

      {creating && (
        <div className="mb-6 flex flex-col gap-2 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            placeholder="Notes…"
            className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Link (optional)"
            className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
          />
          <button
            onClick={create}
            className="self-start rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
          >
            Save
          </button>
        </div>
      )}

      {filtered?.length === 0 && (
        <div className="rounded-lg border border-dashed border-neutral-800 p-8 text-center text-sm text-neutral-500">
          Nothing filed yet.
        </div>
      )}

      <div className="flex flex-col gap-2">
        {filtered?.map((item) => (
          <ReferenceRow
            key={item.id}
            item={item}
            projectTitle={projects?.find((p) => p.id === item.projectId)?.title}
          />
        ))}
      </div>
    </div>
  )
}

function ReferenceRow({ item, projectTitle }: { item: ReferenceItem; projectTitle?: string }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item.content ?? '')

  return (
    <div className="group rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <div className="flex items-start justify-between">
        <div className="font-medium text-neutral-100">{item.title}</div>
        <button
          onClick={() => deleteReference(item.id)}
          className="text-neutral-600 opacity-0 hover:text-red-400 group-hover:opacity-100"
        >
          ✕
        </button>
      </div>
      {item.url && (
        <a href={item.url} target="_blank" rel="noreferrer" className="text-xs text-sky-400 hover:underline">
          {item.url}
        </a>
      )}
      {editing ? (
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            setEditing(false)
            updateReference(item.id, { content: draft })
          }}
          rows={3}
          className="mt-2 w-full rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm outline-none"
        />
      ) : (
        item.content && (
          <p onClick={() => setEditing(true)} className="mt-1 cursor-pointer text-sm text-neutral-400">
            {item.content}
          </p>
        )
      )}
      {projectTitle && <div className="mt-2 text-xs text-neutral-500">↳ {projectTitle}</div>}
    </div>
  )
}
