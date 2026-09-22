/**
 * The address of the Dexie Cloud database this app syncs with. It's a web address, not a secret: nobody can read
 * anything at it without signing in.
 *
 * While there is no address, sync is completely off — no sign-in, no network — and the app behaves exactly as it always
 * has, keeping everything inside the browser. Put the address in PUBLISHED_URL (it comes from `npx dexie-cloud create`)
 * to switch sync on for everyone who uses the published app.
 *
 * For trying things out, VITE_DEXIE_CLOUD_URL (in a local, uncommitted .env.local) overrides it on one machine.
 */
const PUBLISHED_URL = 'https://zd0mzyn9i.dexie.cloud'

export const CLOUD_DATABASE_URL: string = import.meta.env.VITE_DEXIE_CLOUD_URL || PUBLISHED_URL

export const cloudEnabled = CLOUD_DATABASE_URL !== ''
