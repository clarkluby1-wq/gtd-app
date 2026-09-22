import Dexie, { type EntityTable } from 'dexie'
import dexieCloud from 'dexie-cloud-addon'
import { v4 as uuid } from 'uuid'
import { CLOUD_DATABASE_URL } from './cloudConfig'
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
    super('gtd-app', { addons: [dexieCloud] })
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
    // No change to our own tables. A new version number lets the sync add-on add its bookkeeping tables.
    this.version(4).stores({
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

// Sync stays off (no network, no sign-in) until a cloud database address is set in cloudConfig.ts.
if (CLOUD_DATABASE_URL) {
  // nameSuffix defaults to true, which renames the working IndexedDB database (adding the cloud id) the moment
  // this runs — silently abandoning everything already stored under the plain name. Keep the plain name.
  db.cloud.configure({ databaseUrl: CLOUD_DATABASE_URL, requireAuth: false, nameSuffix: false })
}

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

    // The Purpose is a single row, but its id is random (not a fixed word) so two people sharing one cloud database
    // can never collide on it. Older installs used the fixed id 'singleton': move that row to a random one.
    const purposes = await db.purposes.toArray()
    const legacy = purposes.find((p) => p.id === 'singleton')
    if (legacy) {
      await db.purposes.add({ ...legacy, id: uuid() })
      await db.purposes.delete(legacy.id)
    } else if (purposes.length === 0) {
      await db.purposes.add({ id: uuid(), statement: '', principles: [], updatedAt: Date.now() })
    }
  })
}
