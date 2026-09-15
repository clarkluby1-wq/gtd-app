import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'

/**
 * IDs of projects parked as Someday/Maybe. Actions belonging to these
 * shouldn't surface in global engage lists (Next Actions, Waiting For,
 * Calendar) — the project isn't committed to yet, so its actions aren't
 * really actionable right now either.
 */
export function useSomedayProjectIds(): Set<string> {
  const ids = useLiveQuery(() => db.projects.where('status').equals('someday').primaryKeys())
  return new Set((ids ?? []) as string[])
}
