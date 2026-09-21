import { db } from './db'
import type { Purpose } from './types'

/**
 * Two devices that each set themselves up before they've talked to each other both create the starter contexts and
 * Areas of Focus, with different ids. Once they sync, every name appears twice. This finds those pairs.
 *
 * For each name (ignoring case and spacing) the row with the smallest id is kept, so every device — each working it
 * out on its own — makes the same choice and they settle on the same rows. Maps each row to drop -> the row to keep.
 */
export function duplicatesToMerge(rows: { id: string; name: string }[]): Map<string, string> {
  const keepByName = new Map<string, string>()
  const keyOf = (name: string) => name.trim().toLowerCase()
  for (const r of rows) {
    if (keyOf(r.name) === '') continue
    const current = keepByName.get(keyOf(r.name))
    if (current === undefined || r.id < current) keepByName.set(keyOf(r.name), r.id)
  }
  const drops = new Map<string, string>()
  for (const r of rows) {
    const keep = keepByName.get(keyOf(r.name))
    if (keep !== undefined && keep !== r.id) drops.set(r.id, keep)
  }
  return drops
}

const hasContent = (p: Purpose) => p.statement.trim() !== '' || p.principles.length > 0

/** The one Purpose row to show: one that says something beats an empty one, then the most recently edited. */
export function pickPurpose(rows: Purpose[]): Purpose | undefined {
  return [...rows].sort((a, b) => Number(hasContent(b)) - Number(hasContent(a)) || b.updatedAt - a.updatedAt)[0]
}

/** Purpose rows that are empty and not the one being shown — safe to remove without losing anything. */
export function emptyExtraPurposes(rows: Purpose[]): Purpose[] {
  const chosen = pickPurpose(rows)
  return rows.filter((p) => p.id !== chosen?.id && !hasContent(p))
}

/**
 * Tidy up after devices meet: merge duplicate starter contexts and Areas of Focus (pointing anything that used the
 * dropped one at the kept one), and remove empty spare Purpose rows. Safe to run any time; does nothing when there's
 * nothing to fix.
 */
export async function mergeDuplicateDefaults() {
  await db.transaction(
    'rw',
    [db.contexts, db.areasOfFocus, db.purposes, db.actions, db.recurringTemplates, db.projects, db.goals, db.visions, db.references],
    async () => {
      const contexts = await db.contexts.toArray()
      for (const [drop, keep] of duplicatesToMerge(contexts)) {
        await db.actions.where('contextId').equals(drop).modify({ contextId: keep })
        await db.recurringTemplates.filter((t) => t.contextId === drop).modify({ contextId: keep })
        await db.contexts.delete(drop)
      }

      const areas = await db.areasOfFocus.toArray()
      for (const [drop, keep] of duplicatesToMerge(areas)) {
        await db.projects.where('areaOfFocusId').equals(drop).modify({ areaOfFocusId: keep })
        await db.goals.where('areaOfFocusId').equals(drop).modify({ areaOfFocusId: keep })
        await db.visions.where('areaOfFocusId').equals(drop).modify({ areaOfFocusId: keep })
        await db.references.where('areaOfFocusId').equals(drop).modify({ areaOfFocusId: keep })
        await db.areasOfFocus.delete(drop)
      }

      for (const spare of emptyExtraPurposes(await db.purposes.toArray())) {
        await db.purposes.delete(spare.id)
      }
    },
  )
}
