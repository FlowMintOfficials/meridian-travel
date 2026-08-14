/**
 * The docs vault's unlock state — in-memory only, deliberately never
 * persisted (a page reload always re-locks; there is no "remember me").
 *
 * This lives outside DocsTab on purpose. Whether the *current* unlock
 * used the real passphrase or the duress one has to be visible to a
 * couple of other surfaces that touch document data without going
 * through the vault's own UI — the trip tab's document-count badge
 * (TripDetail) and the trip summary export (tripSummary.ts) — so they
 * can suppress anything real while a duress session is active. A
 * decoy vault that still leaks the true count through a badge two
 * inches away, or a document's real name via "Download summary",
 * isn't a decoy at all.
 */

import { useSyncExternalStore } from 'react'

let passphrase: string | null = null
let duress = false
const listeners = new Set<() => void>()

export function getSessionPassphrase(): string | null {
  return passphrase
}

export function isVaultDuressActive(): boolean {
  return duress
}

export function setVaultSession(next: { passphrase: string | null; duress: boolean }): void {
  passphrase = next.passphrase
  duress = next.duress
  for (const fn of listeners) fn()
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** True while the vault is unlocked with the duress passphrase, kept
 * in sync via useSyncExternalStore so anything reading it re-renders
 * the instant a lock/unlock happens anywhere in the app — not just in
 * whichever DocsTab instance is currently mounted. */
export function useVaultDuressActive(): boolean {
  return useSyncExternalStore(subscribe, isVaultDuressActive)
}
