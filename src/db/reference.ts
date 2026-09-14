import { v4 as uuid } from 'uuid'
import { db } from './db'
import type { ReferenceItem } from './types'

export async function createReference(opts: {
  title: string
  content?: string
  url?: string
  projectId?: string
  areaOfFocusId?: string
}) {
  const item: ReferenceItem = {
    id: uuid(),
    title: opts.title,
    content: opts.content,
    url: opts.url,
    projectId: opts.projectId,
    areaOfFocusId: opts.areaOfFocusId,
    createdAt: Date.now(),
  }
  await db.references.add(item)
  return item
}

export async function updateReference(id: string, changes: Partial<ReferenceItem>) {
  await db.references.update(id, changes)
}

export async function deleteReference(id: string) {
  await db.references.delete(id)
}
