export type ActionStatus =
  | 'inbox'
  | 'next'
  | 'waiting'
  | 'someday'
  | 'scheduled'
  | 'done'
  | 'trash'

export type EnergyLevel = 'low' | 'medium' | 'high'

export interface Context {
  id: string
  name: string
  order: number
}

/** Horizon 2 (20,000 ft) — ongoing roles and responsibilities. */
export interface AreaOfFocus {
  id: string
  name: string
  description?: string
  order: number
}

/** Horizon 3 (30,000 ft) — concrete 1-2 year objectives. */
export interface Goal {
  id: string
  title: string
  description?: string
  targetDate?: number
  areaOfFocusId: string
  visionId?: string
  status: 'active' | 'achieved' | 'dropped'
  createdAt: number
}

/** Horizon 4 (40,000 ft) — what wild success looks like, 3-5 years out. */
export interface Vision {
  id: string
  statement: string
  /** Omitted for an overarching, whole-life vision. */
  areaOfFocusId?: string
  createdAt: number
}

/** Horizon 5 (50,000 ft) — the single record describing why any of this matters. */
export interface Purpose {
  id: string
  statement: string
  principles: string[]
  updatedAt: number
}

export type ProjectStatus = 'active' | 'someday' | 'completed' | 'dropped'

export interface NaturalPlanningNotes {
  /** Why this project matters — Horizon 5/4 framing for this specific project. */
  purpose?: string
  /** Freeform capture of everything that comes to mind — no judgment, no order. */
  brainstorm?: string
  /** The brainstorm sorted into components, sequence, or priorities. */
  organized?: string
}

export interface Project {
  id: string
  title: string
  /** What does "done" look like — the successful outcome. */
  outcome: string
  status: ProjectStatus
  areaOfFocusId?: string
  goalId?: string
  planning?: NaturalPlanningNotes
  createdAt: number
  completedAt?: number
  /** Manual sort position. Falls back to createdAt for projects created before this existed. */
  order?: number
}

/** Bookkeeping for the calendar pop-up reminders on one scheduled item. */
export interface ReminderState {
  /** The scheduledDate this applies to. If the item is rescheduled it no longer matches, and reminders start fresh. */
  forDate: number
  /** The "tomorrow" heads-up (or the same-day catch-up) has been dealt with. */
  headsUpDone?: boolean
  /** Asked to be reminded again on the day itself. */
  remindOnDay?: boolean
  /** The same-day reminder has been dealt with. */
  dayOfDone?: boolean
}

export interface Action {
  id: string
  title: string
  notes?: string
  status: ActionStatus
  projectId?: string
  contextId?: string
  energy?: EnergyLevel
  timeEstimateMin?: number
  /** Who or what this item is waiting on, when status === 'waiting'. */
  waitingOn?: string
  /** When this became a Waiting For item — the follow-up clock starts here, not at capture. Older records fall back to clarifiedAt/createdAt. */
  waitingSince?: number
  /** Each time you followed up with whoever this is waiting on, oldest first. */
  followUps?: number[]
  dueDate?: number
  scheduledDate?: number
  reminder?: ReminderState
  createdAt: number
  clarifiedAt?: number
  completedAt?: number
  /** The status this action had right before it was marked done — lets reopening restore it precisely instead of defaulting to Next. */
  previousStatus?: ActionStatus
  /** Last time this action's status or fields changed — drives the Dashboard's stale Next Actions section. */
  touchedAt?: number
  /** Start-of-day timestamp if pinned as one of today's Big Three. Stops applying once the day changes — no explicit reset needed. */
  bigThreeDate?: number
  order: number
  /** Set when this instance was generated from a RecurringTemplate. */
  recurringTemplateId?: string
}

export interface ReferenceItem {
  id: string
  title: string
  content?: string
  url?: string
  projectId?: string
  areaOfFocusId?: string
  createdAt: number
}

export interface WeeklyReviewChecklistItem {
  key: string
  label: string
  done: boolean
  /** Present only for items that break down into their own checkable list, e.g. "clear every inbox". */
  subItems?: { key: string; label: string; done: boolean }[]
}

export interface WeeklyReview {
  id: string
  date: number
  checklist: WeeklyReviewChecklistItem[]
  completedAt?: number
}

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly'

export interface RecurrenceRule {
  frequency: RecurrenceFrequency
  /** Every N days/weeks/months. */
  interval: number
  /** For weekly: 0 (Sun) - 6 (Sat). Defaults to the template's creation weekday. */
  weekdays?: number[]
  /** For monthly: day of month (1-31). */
  dayOfMonth?: number
}

export interface RecurringTemplate {
  id: string
  title: string
  contextId?: string
  projectId?: string
  energy?: EnergyLevel
  timeEstimateMin?: number
  recurrence: RecurrenceRule
  active: boolean
  /** ISO date-key (YYYY-MM-DD) of the last occurrence generated, to avoid duplicates. */
  lastGeneratedKey?: string
  createdAt: number
}

/**
 * A permanent record that a capture happened — written once by captureToInbox
 * and never touched again, independent of whatever later happens to the
 * resulting action (clarified, converted to a project, deleted, ...). This is
 * what "items captured today" counts against, so triaging your inbox (even
 * deleting junk) never reduces the count.
 */
export interface CaptureEvent {
  id: string
  createdAt: number
}
