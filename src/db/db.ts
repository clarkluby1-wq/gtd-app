import Dexie, { type EntityTable } from 'dexie'
import { v4 as uuid } from 'uuid'
import type {
  Action,
  AreaOfFocus,
  Context,
  Project,
  ReferenceItem,
  WeeklyReview,
} from './types'

class GtdDatabase extends Dexie {
  actions!: EntityTable<Action, 'id'>
  projects!: EntityTable<Project, 'id'>
  contexts!: EntityTable<Context, 'id'>
  areasOfFocus!: EntityTable<AreaOfFocus, 'id'>
  references!: EntityTable<ReferenceItem, 'id'>
  weeklyReviews!: EntityTable<WeeklyReview, 'id'>

  constructor() {
    super('gtd-app')
    this.version(1).stores({
      actions: 'id, status, projectId, contextId, dueDate, scheduledDate, order, createdAt',
      projects: 'id, status, areaOfFocusId, createdAt',
      contexts: 'id, order',
      areasOfFocus: 'id, order',
      references: 'id, createdAt',
      weeklyReviews: 'id, date',
    })
  }
}

export const db = new GtdDatabase()

const DEFAULT_CONTEXTS = ['@calls', '@computer', '@errands', '@home', '@office', '@anywhere']

const DEFAULT_AREAS_OF_FOCUS = [
  { name: 'Work', description: 'Professional responsibilities and career.' },
  { name: 'Health', description: 'Physical and mental wellbeing.' },
  { name: 'Home & Family', description: 'Household and relationships.' },
  { name: 'Finances', description: 'Money, budgeting, and planning.' },
  { name: 'Personal Growth', description: 'Learning, hobbies, and development.' },
]

export async function seedDefaultsIfEmpty() {
  const contextCount = await db.contexts.count()
  if (contextCount === 0) {
    await db.contexts.bulkAdd(
      DEFAULT_CONTEXTS.map((name, i) => ({ id: uuid(), name, order: i })),
    )
  }

  const areaCount = await db.areasOfFocus.count()
  if (areaCount === 0) {
    await db.areasOfFocus.bulkAdd(
      DEFAULT_AREAS_OF_FOCUS.map((a, i) => ({ id: uuid(), order: i, ...a })),
    )
  }
}
