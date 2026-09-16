import Dexie, { type EntityTable } from 'dexie'
import { v4 as uuid } from 'uuid'
import type {
  Action,
  AreaOfFocus,
  CaptureEvent,
  Context,
  Goal,
  Project,
  Purpose,
  ReferenceItem,
  RecurringTemplate,
  Vision,
  WeeklyReview,
} from './types'

class GtdDatabase extends Dexie {
  actions!: EntityTable<Action, 'id'>
  projects!: EntityTable<Project, 'id'>
  contexts!: EntityTable<Context, 'id'>
  areasOfFocus!: EntityTable<AreaOfFocus, 'id'>
  goals!: EntityTable<Goal, 'id'>
  visions!: EntityTable<Vision, 'id'>
  purposes!: EntityTable<Purpose, 'id'>
  references!: EntityTable<ReferenceItem, 'id'>
  weeklyReviews!: EntityTable<WeeklyReview, 'id'>
  recurringTemplates!: EntityTable<RecurringTemplate, 'id'>
  captureEvents!: EntityTable<CaptureEvent, 'id'>

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
    this.version(2).stores({
      actions:
        'id, status, projectId, contextId, dueDate, scheduledDate, order, createdAt, recurringTemplateId',
      projects: 'id, status, areaOfFocusId, goalId, createdAt',
      contexts: 'id, order',
      areasOfFocus: 'id, order',
      goals: 'id, areaOfFocusId, visionId, status, createdAt',
      visions: 'id, areaOfFocusId, createdAt',
      purposes: 'id',
      references: 'id, projectId, areaOfFocusId, createdAt',
      weeklyReviews: 'id, date',
      recurringTemplates: 'id, projectId, createdAt',
    })
    this.version(3).stores({
      actions:
        'id, status, projectId, contextId, dueDate, scheduledDate, order, createdAt, recurringTemplateId',
      projects: 'id, status, areaOfFocusId, goalId, createdAt',
      contexts: 'id, order',
      areasOfFocus: 'id, order',
      goals: 'id, areaOfFocusId, visionId, status, createdAt',
      visions: 'id, areaOfFocusId, createdAt',
      purposes: 'id',
      references: 'id, projectId, areaOfFocusId, createdAt',
      weeklyReviews: 'id, date',
      recurringTemplates: 'id, projectId, createdAt',
      captureEvents: 'id, createdAt',
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
  // A single readwrite transaction serializes concurrent calls (e.g. React
  // StrictMode's double-invoked effect in dev) so the count-then-write checks
  // below can't race against each other.
  await db.transaction('rw', db.contexts, db.areasOfFocus, db.purposes, async () => {
    const contextCount = await db.contexts.count()
    if (contextCount === 0) {
      await db.contexts.bulkAdd(DEFAULT_CONTEXTS.map((name, i) => ({ id: uuid(), name, order: i })))
    }

    const areaCount = await db.areasOfFocus.count()
    if (areaCount === 0) {
      await db.areasOfFocus.bulkAdd(
        DEFAULT_AREAS_OF_FOCUS.map((a, i) => ({ id: uuid(), order: i, ...a })),
      )
    }

    const purposeExists = await db.purposes.get('singleton')
    if (!purposeExists) {
      await db.purposes.add({ id: 'singleton', statement: '', principles: [], updatedAt: Date.now() })
    }
  })
}
