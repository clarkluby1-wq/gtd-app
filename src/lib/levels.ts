import { useCallback, useMemo, useSyncExternalStore } from 'react'
import type { ViewKey } from '../components/Sidebar'

/**
 * How much of GTD you see. Every level hides screens and options — it never touches your data, so stepping down
 * and back up loses nothing. Capture, Inbox, Today, Next Actions, the Short List, Waiting For, Someday/Maybe,
 * Reference and (simple) Projects are in every level; the features below are what the levels switch on and off.
 */
export type FeatureKey =
  | 'calendar'
  | 'dayFlows'
  | 'dashboard'
  | 'history'
  | 'mindSweep'
  | 'weeklyReview'
  | 'horizons'
  | 'planning'

export type Level = 'lite' | 'standard' | 'full' | 'custom'

export const FEATURES: { key: FeatureKey; label: string; hint: string }[] = [
  { key: 'calendar', label: 'Calendar', hint: 'Scheduling something for a day and time, and the Calendar screen.' },
  { key: 'dayFlows', label: 'Start & End My Day', hint: 'The guided morning look and evening wind-down.' },
  { key: 'dashboard', label: 'Dashboard', hint: 'The overview of projects, Waiting For and activity.' },
  { key: 'history', label: "What I've Done & Recently Completed", hint: 'Looking back at what you finished.' },
  { key: 'mindSweep', label: 'Mind Sweep', hint: 'The guided brain-dump with trigger lists.' },
  { key: 'weeklyReview', label: 'Weekly Review', hint: 'The guided review, its reminder and its Today banner.' },
  { key: 'horizons', label: 'Horizons of Focus', hint: 'Purpose, Vision, Goals and Areas of Focus, and linking projects to them.' },
  { key: 'planning', label: 'Deep Plan (Natural Planning)', hint: 'The step-by-step project planning walkthrough.' },
]

const ALL: FeatureKey[] = FEATURES.map((f) => f.key)
const PRESETS: Record<Exclude<Level, 'custom'>, FeatureKey[]> = {
  lite: [],
  standard: ['calendar', 'dayFlows', 'dashboard', 'history', 'mindSweep'],
  full: ALL,
}

export const LEVEL_INFO: { level: Exclude<Level, 'custom'>; label: string; summary: string; detail: string }[] = [
  {
    level: 'lite',
    label: 'Lite',
    summary: 'The essentials',
    detail: 'Capture, Inbox, Today, Next Actions, a Short List, Waiting For, Someday/Maybe, Reference and simple Projects.',
  },
  {
    level: 'standard',
    label: 'Standard',
    summary: 'A fuller daily rhythm',
    detail: 'Everything in Lite, plus the Calendar, Start & End My Day, the Dashboard, your history and Mind Sweep.',
  },
  {
    level: 'full',
    label: 'Full GTD',
    summary: 'The whole system',
    detail: 'Everything in Standard, plus the Weekly Review, Deep Plan, and all the Horizons of Focus.',
  },
]

/** Which screens belong to which feature. A screen that isn't listed is in every level. */
const VIEW_FEATURE: Partial<Record<ViewKey, FeatureKey>> = {
  startday: 'dayFlows',
  endday: 'dayFlows',
  report: 'history',
  completed: 'history',
  dashboard: 'dashboard',
  calendar: 'calendar',
  review: 'weeklyReview',
  purpose: 'horizons',
  vision: 'horizons',
  goals: 'horizons',
  areas: 'horizons',
}

const LEVEL_KEY = 'gtd-app:level'
const FEATURES_KEY = 'gtd-app:custom-features'
const CHANGED = 'gtd-app:level-changed'

// Stored on this device, like the other display settings. (Syncing it would mean changing the cloud database's
// shape, which isn't worth risking for a preference; each device can also have its own level.)
function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Not remembering is fine; it would just ask again next time.
  }
  window.dispatchEvent(new Event(CHANGED))
}

function parseLevel(raw: string | null): Level | null {
  return raw === 'lite' || raw === 'standard' || raw === 'full' || raw === 'custom' ? raw : null
}

function parseFeatures(raw: string | null): FeatureKey[] {
  try {
    const list = JSON.parse(raw ?? '[]') as unknown
    return Array.isArray(list) ? ALL.filter((k) => list.includes(k)) : []
  } catch {
    return []
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGED, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(CHANGED, onChange)
    window.removeEventListener('storage', onChange)
  }
}

const snapshot = () => `${read(LEVEL_KEY) ?? ''}|${read(FEATURES_KEY) ?? ''}`

export function enabledFeatures(level: Level | null, custom: FeatureKey[]): FeatureKey[] {
  // Until a level has been chosen, nothing is hidden — an existing install keeps everything it had.
  if (level === null) return ALL
  return level === 'custom' ? custom : PRESETS[level]
}

export function setLevel(level: Exclude<Level, 'custom'>) {
  write(LEVEL_KEY, level)
}

/** Switch one feature on or off. Doing that from a preset turns it into "Custom", starting from what that preset showed. */
export function setFeature(feature: FeatureKey, on: boolean) {
  const level = parseLevel(read(LEVEL_KEY))
  const base = level === 'custom' ? parseFeatures(read(FEATURES_KEY)) : enabledFeatures(level, [])
  const next = on ? [...new Set([...base, feature])] : base.filter((k) => k !== feature)
  write(FEATURES_KEY, JSON.stringify(next))
  write(LEVEL_KEY, 'custom')
}

/** What the current level shows. Re-renders whenever the level changes, on this device or in another tab. */
export function useFeatures() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => '|')
  const { level, enabled } = useMemo(() => {
    const [levelRaw, featuresRaw] = raw.split('|')
    const level = parseLevel(levelRaw || null)
    return { level, enabled: new Set(enabledFeatures(level, parseFeatures(featuresRaw || null))) }
  }, [raw])

  const has = useCallback((feature: FeatureKey) => enabled.has(feature), [enabled])
  const showsView = useCallback(
    (view: ViewKey) => {
      const feature = VIEW_FEATURE[view]
      return feature === undefined || enabled.has(feature)
    },
    [enabled],
  )
  return { level, decided: level !== null, has, showsView }
}
