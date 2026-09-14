import { v4 as uuid } from 'uuid'
import { db } from './db'
import type { Action, RecurrenceRule, RecurringTemplate } from './types'

export async function createRecurringTemplate(opts: {
  title: string
  contextId?: string
  projectId?: string
  energy?: RecurringTemplate['energy']
  timeEstimateMin?: number
  recurrence: RecurrenceRule
}) {
  const template: RecurringTemplate = {
    id: uuid(),
    title: opts.title,
    contextId: opts.contextId,
    projectId: opts.projectId,
    energy: opts.energy,
    timeEstimateMin: opts.timeEstimateMin,
    recurrence: opts.recurrence,
    active: true,
    createdAt: Date.now(),
  }
  await db.recurringTemplates.add(template)
  return template
}

export async function updateRecurringTemplate(id: string, changes: Partial<RecurringTemplate>) {
  await db.recurringTemplates.update(id, changes)
}

export async function deleteRecurringTemplate(id: string) {
  await db.recurringTemplates.delete(id)
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

function daysBetween(a: Date, b: Date) {
  const msPerDay = 24 * 60 * 60 * 1000
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
  return Math.round((utcB - utcA) / msPerDay)
}

function monthsBetween(a: Date, b: Date) {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
}

/** Does this template's schedule land on `today`, given it started on `start`? */
export function isDue(rule: RecurrenceRule, start: Date, today: Date): boolean {
  const interval = Math.max(1, rule.interval)
  if (rule.frequency === 'daily') {
    return daysBetween(start, today) % interval === 0
  }
  if (rule.frequency === 'weekly') {
    const weekdays = rule.weekdays?.length ? rule.weekdays : [start.getDay()]
    if (!weekdays.includes(today.getDay())) return false
    const weeksSinceStart = Math.floor(daysBetween(start, today) / 7)
    return weeksSinceStart % interval === 0
  }
  // monthly
  const dayOfMonth = rule.dayOfMonth ?? start.getDate()
  if (today.getDate() !== dayOfMonth) return false
  return monthsBetween(start, today) % interval === 0
}

/**
 * Check every active recurring template and generate today's Action instance
 * if it's due and hasn't already been created. Call once per app load.
 */
export async function generateDueOccurrences(now: Date = new Date()) {
  const today = dateKey(now)

  // One readwrite transaction serializes concurrent calls (e.g. React StrictMode's
  // double-invoked effect in dev) so two calls can't both pass the lastGeneratedKey
  // check before either writes, which would otherwise generate duplicate occurrences.
  await db.transaction('rw', db.recurringTemplates, db.actions, async () => {
    const active = (await db.recurringTemplates.toArray()).filter((t) => t.active)

    for (const template of active) {
      if (template.lastGeneratedKey === today) continue
      const start = new Date(template.createdAt)
      if (!isDue(template.recurrence, start, now)) continue

      const action: Action = {
        id: uuid(),
        title: template.title,
        status: 'scheduled',
        scheduledDate: new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime(),
        projectId: template.projectId,
        contextId: template.contextId,
        energy: template.energy,
        timeEstimateMin: template.timeEstimateMin,
        recurringTemplateId: template.id,
        createdAt: Date.now(),
        clarifiedAt: Date.now(),
        order: Date.now(),
      }
      await db.actions.add(action)
      await db.recurringTemplates.update(template.id, { lastGeneratedKey: today })
    }
  })
}
