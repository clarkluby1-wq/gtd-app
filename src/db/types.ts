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

export interface AreaOfFocus {
  id: string
  name: string
  description?: string
  order: number
}

export type ProjectStatus = 'active' | 'someday' | 'completed' | 'dropped'

export interface Project {
  id: string
  title: string
  /** What does "done" look like — the successful outcome. */
  outcome: string
  status: ProjectStatus
  areaOfFocusId?: string
  createdAt: number
  completedAt?: number
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
  dueDate?: number
  scheduledDate?: number
  createdAt: number
  clarifiedAt?: number
  completedAt?: number
  order: number
}

export interface ReferenceItem {
  id: string
  title: string
  content?: string
  url?: string
  createdAt: number
}

export interface WeeklyReviewChecklistItem {
  key: string
  label: string
  done: boolean
}

export interface WeeklyReview {
  id: string
  date: number
  checklist: WeeklyReviewChecklistItem[]
  completedAt?: number
}
