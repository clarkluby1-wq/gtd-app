import { useObservable } from 'dexie-react-hooks'
import { db } from '../db/db'
import { cloudEnabled } from '../db/cloudConfig'
import { describeSync, type SyncView } from './syncStatus'

export interface SyncInfo extends SyncView {
  enabled: boolean
  signedIn: boolean
  email?: string
}

/** Where sync stands right now, live. Everything reads "off" while no cloud database is set up. */
export function useSync(): SyncInfo {
  const user = useObservable(db.cloud.currentUser)
  const state = useObservable(db.cloud.syncState)
  const signedIn = cloudEnabled && user?.isLoggedIn === true
  return {
    enabled: cloudEnabled,
    signedIn,
    email: signedIn ? user?.email : undefined,
    ...describeSync({ enabled: cloudEnabled, signedIn, phase: state?.phase, status: state?.status }),
  }
}
