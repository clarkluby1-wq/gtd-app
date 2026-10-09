import { useObservable } from 'dexie-react-hooks'
import { db } from '../db/db'
import { cloudEnabled } from '../db/cloudConfig'
import { describeSync, type SyncView } from './syncStatus'

export interface SyncInfo extends SyncView {
  enabled: boolean
  signedIn: boolean
  email?: string
  /** What kind of account this is and how much of a trial is left, when the service says. */
  account?: { type?: string; status?: string; evalDaysLeft?: number; validUntil?: Date }
  /** The sync service's own words about what's wrong, for working out a problem — "error / disconnected: Failed to fetch". */
  detail?: string
}

/** Where sync stands right now, live. Everything reads "off" while no cloud database is set up. */
export function useSync(): SyncInfo {
  const user = useObservable(db.cloud.currentUser)
  const state = useObservable(db.cloud.syncState)
  const signedIn = cloudEnabled && user?.isLoggedIn === true
  const license = user?.license
  return {
    enabled: cloudEnabled,
    signedIn,
    email: signedIn ? user?.email : undefined,
    account: signedIn && license ? { ...license } : undefined,
    detail: signedIn
      ? [[state?.phase, state?.status].filter(Boolean).join(' / '), state?.error?.message].filter(Boolean).join(': ') || undefined
      : undefined,
    ...describeSync({
      enabled: cloudEnabled,
      signedIn,
      phase: state?.phase,
      status: state?.status,
      license: license?.status,
    }),
  }
}
