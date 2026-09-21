export type SyncKind = 'off' | 'signedOut' | 'synced' | 'syncing' | 'offline' | 'error'

export interface SyncView {
  kind: SyncKind
  /** Short, plain wording for a status line. */
  label: string
}

/**
 * Turns the sync service's state into words. Kept apart from the service itself so the wording can be tested, and so
 * the rest of the app never has to know its vocabulary.
 */
export function describeSync(input: {
  enabled: boolean
  signedIn: boolean
  phase?: string
  status?: string
}): SyncView {
  if (!input.enabled) return { kind: 'off', label: 'Sync is off' }
  if (!input.signedIn) return { kind: 'signedOut', label: 'Not signed in' }
  if (input.phase === 'error' || input.status === 'error') {
    return { kind: 'error', label: "Couldn't sync just now. It will keep trying" }
  }
  if (input.phase === 'offline' || input.status === 'offline') {
    return { kind: 'offline', label: "Offline. Changes will sync when you're back online" }
  }
  if (input.phase === 'in-sync') return { kind: 'synced', label: 'Everything is synced' }
  return { kind: 'syncing', label: 'Syncing…' }
}
