import type { Trip, TripType } from '../types'

/**
 * Encodes a trip's basics into a compact URL-safe code — shareable as a
 * link or a scannable QR code (see QrCode.tsx / lib/qrcode.ts). Everything
 * stays on-device: this is plain client-side encoding, no server involved,
 * and only the fields below travel — packing, itinerary, expenses,
 * checklist, photos, and documents are intentionally left out so the code
 * (and the QR rendering it) stays small.
 */
export interface SharedTripData {
  name: string
  type: TripType
  startDate: string
  endDate: string
  homeCurrency: string
  tripCurrency: string
  destinations: Trip['destinations']
  travelerCount: number
  travelers: string[]
  budgetTarget?: number
  timezone?: string
  notes?: string
}

const VALID_TRIP_TYPES = new Set<TripType>([
  'general', 'beach', 'business', 'city', 'camping', 'ski', 'roadtrip', 'family',
])

/** A share code is attacker-controlled input decoded off-device (pasted or
 * scanned) — cap its raw size well above anything `encodeSharedTrip` would
 * ever produce so a crafted code can't balloon into a multi-MB `atob`/
 * `JSON.parse` or a giant persisted trip. */
const MAX_CODE_LENGTH = 8_000
const MAX_STRING_FIELD = 500
const MAX_LIST_LENGTH = 30

/** `YYYY-MM-DD` that also round-trips through `Date` — rejects things like
 * `"0000-00-00"` or `"9999-99-99"` that match the shape but aren't real. */
function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

function isValidCurrencyCode(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z]{3}$/.test(value)
}

function clampString(value: unknown, max = MAX_STRING_FIELD): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value.slice(0, max) : undefined
}

/** Short keys and tuple-encoded destinations — every byte here inflates
 * the QR code's module count, so this stays as compact as plain JSON
 * reasonably allows. */
interface Wire {
  n: string
  y: string
  s: string
  e: string
  h: string
  t: string
  d?: Array<[string, string, string?, number?, number?]>
  c: number
  r?: string[]
  b?: number
  z?: string
  o?: string
}

const HASH_KEY = 'share-trip'

export function encodeSharedTrip(trip: Trip): string {
  const wire: Wire = {
    n: trip.name,
    y: trip.type,
    s: trip.startDate,
    e: trip.endDate,
    h: trip.homeCurrency,
    t: trip.tripCurrency,
    c: trip.travelerCount,
  }
  if (trip.destinations.length > 0) {
    wire.d = trip.destinations.map((d) => [d.city, d.country, d.countryCode, d.latitude, d.longitude])
  }
  if (trip.travelers.length > 0) wire.r = trip.travelers
  if (trip.budgetTarget != null) wire.b = trip.budgetTarget
  if (trip.timezone) wire.z = trip.timezone
  if (trip.notes) wire.o = trip.notes
  return base64UrlEncode(JSON.stringify(wire))
}

export function decodeSharedTrip(code: string): SharedTripData | null {
  if (typeof code !== 'string' || code.length === 0 || code.length > MAX_CODE_LENGTH) return null
  try {
    const wire = JSON.parse(base64UrlDecode(code)) as Partial<Wire>
    if (
      !wire.n ||
      typeof wire.n !== 'string' ||
      !wire.y ||
      !isValidIsoDate(wire.s) ||
      !isValidIsoDate(wire.e) ||
      !isValidCurrencyCode(wire.h) ||
      !isValidCurrencyCode(wire.t)
    ) {
      return null
    }
    const type = VALID_TRIP_TYPES.has(wire.y as TripType) ? (wire.y as TripType) : 'general'
    const latOk = (n: unknown): n is number => typeof n === 'number' && n >= -90 && n <= 90
    const lonOk = (n: unknown): n is number => typeof n === 'number' && n >= -180 && n <= 180
    return {
      name: wire.n.slice(0, 80),
      type,
      startDate: wire.s,
      endDate: wire.e,
      homeCurrency: wire.h.toUpperCase(),
      tripCurrency: wire.t.toUpperCase(),
      destinations: Array.isArray(wire.d)
        ? wire.d
            .slice(0, MAX_LIST_LENGTH)
            .map((entry) => ({
              city: clampString(entry?.[0], 120) ?? '',
              country: clampString(entry?.[1], 120) ?? '',
              countryCode: clampString(entry?.[2], 8),
              latitude: latOk(entry?.[3]) ? entry[3] : undefined,
              longitude: lonOk(entry?.[4]) ? entry[4] : undefined,
            }))
            .filter((d) => d.city || d.country)
        : [],
      travelerCount:
        typeof wire.c === 'number' && wire.c > 0 ? Math.min(wire.c, 500) : 1,
      travelers: Array.isArray(wire.r)
        ? wire.r
            .filter((n) => typeof n === 'string')
            .slice(0, MAX_LIST_LENGTH)
            .map((n) => n.slice(0, 80))
        : [],
      budgetTarget:
        typeof wire.b === 'number' && wire.b > 0 && Number.isFinite(wire.b) ? wire.b : undefined,
      timezone: clampString(wire.z, 60),
      notes: clampString(wire.o, 2000),
    }
  } catch {
    return null
  }
}

export function buildShareUrl(trip: Trip): string {
  const code = encodeSharedTrip(trip)
  const url = new URL(window.location.href)
  url.hash = `${HASH_KEY}=${code}`
  return url.toString()
}

/** Accepts either a full shared link or a bare code (e.g. pasted from a
 * message instead of clicked) and extracts just the code portion. */
export function extractShareCode(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed || trimmed.length > MAX_CODE_LENGTH) return null
  const hashMatch = trimmed.match(new RegExp(`${HASH_KEY}=([^&\\s]+)`))
  if (hashMatch) return hashMatch[1].slice(0, MAX_CODE_LENGTH)
  if (/^[A-Za-z0-9_-]+$/.test(trimmed)) return trimmed
  return null
}

export function readShareCodeFromLocation(): string | null {
  return extractShareCode(window.location.hash)
}

/** Strips the share code from the URL after it's been handled, so
 * reloading (or navigating away and back) doesn't re-prompt the import. */
export function clearShareCodeFromLocation(): void {
  const url = new URL(window.location.href)
  url.hash = ''
  window.history.replaceState(null, '', url.toString())
}

// Exported — lib/peerSync.ts reuses these for its own (differently-shaped)
// compact codes, same rationale: URL/QR-safe text out of arbitrary JSON.
export function base64UrlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function base64UrlDecode(str: string): string {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/')
  const pad = (4 - (padded.length % 4)) % 4
  const binary = atob(padded + '='.repeat(pad))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}
