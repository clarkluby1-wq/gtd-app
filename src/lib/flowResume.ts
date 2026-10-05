import { startOfWorkday } from './date'

export type DayFlow = 'startday' | 'endday'

const key = (flow: DayFlow) => `gtd.flowStep.${flow}`

/**
 * Where you were in Start My Day / End My Day, so stepping out to the Inbox or Calendar and coming back lands on the
 * same step. It only holds for the current workday — tomorrow always begins at step 1.
 */
export function readFlowStep(flow: DayFlow): string | undefined {
  try {
    const raw = JSON.parse(localStorage.getItem(key(flow)) ?? 'null')
    if (raw && raw.day === startOfWorkday() && typeof raw.step === 'string') return raw.step
  } catch {
    // Starting at step 1 is fine.
  }
  return undefined
}

export function saveFlowStep(flow: DayFlow, step: string) {
  try {
    localStorage.setItem(key(flow), JSON.stringify({ day: startOfWorkday(), step }))
  } catch {
    // Your place just won't be remembered.
  }
}

/** Finishing the flow: next time starts fresh at step 1. */
export function clearFlowStep(flow: DayFlow) {
  try {
    localStorage.removeItem(key(flow))
  } catch {
    // Nothing to do.
  }
}
