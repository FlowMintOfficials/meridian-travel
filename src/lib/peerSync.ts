import { base64UrlDecode, base64UrlEncode } from './tripShare'
import type { ChecklistItem, Expense, ItineraryEvent, PackingItem, Trip } from '../types'

/**
 * Serverless device-to-device sync over WebRTC — no signaling server, no
 * account, no relay for trip data. The two devices exchange a short
 * connection code by whatever channel they like (show a QR code, paste
 * into a chat, read it aloud) exactly once each direction, then talk
 * directly to each other over an encrypted RTCDataChannel.
 *
 * A public STUN server is used purely for NAT traversal — discovering
 * each side's reachable IP:port so they can find a direct path to each
 * other. It never sees trip data, only network topology, exactly like
 * any other WebRTC app (video calls, etc.) already needs.
 *
 * This is one-shot pairing, not a persistent connection: open it,
 * exchange two short codes, sync once, close it. There's no presence
 * and no "always-on" peer to reconnect to — by design, matching
 * everything else about this app staying off unless a user acts.
 */

const ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }]
const ICE_GATHER_TIMEOUT_MS = 6000
const OFFER_PREFIX = 'MSO1:'
const ANSWER_PREFIX = 'MSA1:'

export function peerSyncSupported(): boolean {
  return typeof RTCPeerConnection !== 'undefined'
}

interface SyncCode {
  type: 'offer' | 'answer'
  sdp: string
}

function encodeCode(type: 'offer' | 'answer', sdp: string): string {
  const prefix = type === 'offer' ? OFFER_PREFIX : ANSWER_PREFIX
  return prefix + base64UrlEncode(JSON.stringify({ type, sdp }))
}

function decodeCode(code: string): SyncCode {
  const trimmed = code.trim()
  const body = trimmed.startsWith(OFFER_PREFIX)
    ? trimmed.slice(OFFER_PREFIX.length)
    : trimmed.startsWith(ANSWER_PREFIX)
      ? trimmed.slice(ANSWER_PREFIX.length)
      : trimmed
  let parsed: Partial<SyncCode>
  try {
    parsed = JSON.parse(base64UrlDecode(body)) as Partial<SyncCode>
  } catch {
    throw new Error('That code looks corrupted — check it was copied in full.')
  }
  if ((parsed.type !== 'offer' && parsed.type !== 'answer') || typeof parsed.sdp !== 'string') {
    throw new Error('That doesn’t look like a Meridian pairing code.')
  }
  return parsed as SyncCode
}

/** Which kind of code this is, without throwing — for the UI to route a
 * pasted code without needing its own try/catch at every call site. */
export function codeKind(code: string): 'offer' | 'answer' | null {
  try {
    return decodeCode(code).type
  } catch {
    return null
  }
}

function waitForIceGatheringComplete(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve()
  return new Promise((resolve) => {
    const check = () => {
      if (pc.iceGatheringState === 'complete') done()
    }
    // Some networks never report "complete" (a candidate type silently
    // blocked, e.g.) — proceed with whatever's gathered rather than hang
    // the whole pairing flow forever on it.
    const timer = window.setTimeout(done, ICE_GATHER_TIMEOUT_MS)
    function done() {
      window.clearTimeout(timer)
      pc.removeEventListener('icegatheringstatechange', check)
      resolve()
    }
    pc.addEventListener('icegatheringstatechange', check)
  })
}

export interface SyncSession {
  pc: RTCPeerConnection
  /** On the offering (host) side the channel exists immediately. On the
   * answering (joining) side it only arrives via `ondatachannel` once the
   * connection actually completes — which requires the host to have
   * already applied *our* answer. So this can't be a plain `channel`
   * field resolved up front on both sides without deadlocking one of
   * them waiting on the other before either code is even shown. */
  channelPromise: Promise<RTCDataChannel>
}

/** Host side, step 1: create the connection + data channel, produce a
 * code to hand to the other device. */
export async function createSyncOffer(): Promise<{ session: SyncSession; code: string }> {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
  const channel = pc.createDataChannel('meridian-sync', { ordered: true })
  const offer = await pc.createOffer()
  await pc.setLocalDescription(offer)
  await waitForIceGatheringComplete(pc)
  const sdp = pc.localDescription?.sdp ?? offer.sdp ?? ''
  return { session: { pc, channelPromise: Promise.resolve(channel) }, code: encodeCode('offer', sdp) }
}

/** Host side, step 2: apply the other device's answer once they've sent
 * it back (out of band — read off their screen, pasted from a message). */
export async function applySyncAnswer(session: SyncSession, answerCode: string): Promise<void> {
  const { type, sdp } = decodeCode(answerCode)
  if (type !== 'answer') throw new Error('That’s a pairing code, but not an answer code.')
  await session.pc.setRemoteDescription({ type: 'answer', sdp })
}

/** Joining side: given the host's offer code, create our own connection,
 * apply it, and produce our answer code to send back. Deliberately does
 * *not* wait for the data channel here — see the SyncSession comment
 * above for why that would deadlock. `channelPromise` resolves later,
 * once the host has applied this answer and the connection completes. */
export async function createSyncAnswer(
  offerCode: string,
): Promise<{ session: SyncSession; code: string }> {
  const { type, sdp } = decodeCode(offerCode)
  if (type !== 'offer') throw new Error('That’s a pairing code, but not an offer code.')
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
  const channelPromise = new Promise<RTCDataChannel>((resolve) => {
    pc.ondatachannel = (e) => resolve(e.channel)
  })
  await pc.setRemoteDescription({ type: 'offer', sdp })
  const answer = await pc.createAnswer()
  await pc.setLocalDescription(answer)
  await waitForIceGatheringComplete(pc)
  const localSdp = pc.localDescription?.sdp ?? answer.sdp ?? ''
  return { session: { pc, channelPromise }, code: encodeCode('answer', localSdp) }
}

export function closeSyncSession(session: SyncSession | null): void {
  if (!session) return
  session.channelPromise.then(
    (ch) => {
      try {
        ch.close()
      } catch {
        /* already closed */
      }
    },
    () => {
      /* channel never arrived — nothing to close */
    },
  )
  try {
    session.pc.close()
  } catch {
    /* already closed */
  }
}

/** Resolves with the data channel once it's arrived *and* open, or
 * rejects on failure/timeout (e.g. both devices are behind restrictive
 * NATs with no direct path to each other). A generous default — this
 * window has to cover a human relaying the other side's code (reading a
 * QR, typing/pasting text), not just network round-trip time. */
export async function waitForChannelOpen(
  session: SyncSession,
  timeoutMs = 90_000,
): Promise<RTCDataChannel> {
  const deadline = new Promise<never>((_, reject) => {
    window.setTimeout(() => reject(new Error('Timed out waiting to connect.')), timeoutMs)
  })
  const channel = await Promise.race([session.channelPromise, deadline])
  if (channel.readyState === 'open') return channel
  return new Promise((resolve, reject) => {
    const onOpen = () => {
      cleanup()
      resolve(channel)
    }
    const onStateChange = () => {
      if (session.pc.connectionState === 'failed' || session.pc.connectionState === 'closed') {
        cleanup()
        reject(new Error('Could not connect — the two devices couldn’t reach each other.'))
      }
    }
    const timer = window.setTimeout(() => {
      cleanup()
      reject(new Error('Timed out waiting to connect.'))
    }, timeoutMs)
    function cleanup() {
      window.clearTimeout(timer)
      channel.removeEventListener('open', onOpen)
      session.pc.removeEventListener('connectionstatechange', onStateChange)
    }
    channel.addEventListener('open', onOpen)
    session.pc.addEventListener('connectionstatechange', onStateChange)
  })
}

export function sendJson(channel: RTCDataChannel, value: unknown): void {
  channel.send(JSON.stringify(value))
}

/** Resolves with the first message received, parsed as JSON — the sync
 * protocol here is exactly one message per side, so no need to listen
 * beyond that. */
export function receiveJson<T = unknown>(channel: RTCDataChannel, timeoutMs = 20_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const onMessage = (e: MessageEvent) => {
      cleanup()
      try {
        resolve(JSON.parse(e.data as string) as T)
      } catch {
        reject(new Error('Received unreadable data from the other device.'))
      }
    }
    const onClose = () => {
      cleanup()
      reject(new Error('Connection closed before data arrived.'))
    }
    const timer = window.setTimeout(() => {
      cleanup()
      reject(new Error('Timed out waiting for the other device.'))
    }, timeoutMs)
    function cleanup() {
      window.clearTimeout(timer)
      channel.removeEventListener('message', onMessage)
      channel.removeEventListener('close', onClose)
    }
    channel.addEventListener('message', onMessage)
    channel.addEventListener('close', onClose)
  })
}

// ------------------------------------------------------------- protocol

export const TRIP_SYNC_VERSION = 1

/** What actually crosses the data channel — one trip's worth of records.
 * Deliberately the same scope tripShare.ts's QR/link sharing excludes:
 * no documents (vault-encrypted, and the passphrase isn't part of this
 * exchange) and no photos (blobs live in IndexedDB, not worth shipping
 * over a data channel meant for periodic small syncs). */
export interface TripSyncPayload {
  type: 'meridian-trip-sync'
  version: typeof TRIP_SYNC_VERSION
  trip: Trip
  packing: PackingItem[]
  itinerary: ItineraryEvent[]
  checklist: ChecklistItem[]
  expenses: Expense[]
}

export function isTripSyncPayload(value: unknown): value is TripSyncPayload {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Partial<TripSyncPayload>
  return (
    v.type === 'meridian-trip-sync' &&
    v.version === TRIP_SYNC_VERSION &&
    typeof v.trip === 'object' &&
    v.trip !== null &&
    Array.isArray(v.packing) &&
    Array.isArray(v.itinerary) &&
    Array.isArray(v.checklist) &&
    Array.isArray(v.expenses)
  )
}

interface SyncableData {
  packing: PackingItem[]
  itinerary: ItineraryEvent[]
  checklist: ChecklistItem[]
  expenses: Expense[]
}

export function buildTripSyncPayload(trip: Trip, data: SyncableData): TripSyncPayload {
  return {
    type: 'meridian-trip-sync',
    version: TRIP_SYNC_VERSION,
    trip,
    packing: data.packing.filter((p) => p.tripId === trip.id),
    itinerary: data.itinerary.filter((e) => e.tripId === trip.id),
    checklist: data.checklist.filter((c) => c.tripId === trip.id),
    expenses: data.expenses.filter((e) => e.tripId === trip.id),
  }
}
