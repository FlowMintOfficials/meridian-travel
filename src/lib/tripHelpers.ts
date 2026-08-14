import type { Destination, MeridianData, Trip, TripType } from '../types'

export const TRIP_TYPE_LABELS: Record<TripType, string> = {
  beach: 'Beach getaway',
  business: 'Business trip',
  city: 'City break',
  camping: 'Camping / hiking',
  ski: 'Ski / snow trip',
  roadtrip: 'Road trip',
  family: 'Family trip',
  general: 'General',
}

export const TRIP_TYPE_ICONS: Record<TripType, string> = {
  beach: 'sun',
  business: 'briefcase',
  city: 'building',
  camping: 'tent',
  ski: 'snow',
  roadtrip: 'car',
  family: 'users',
  general: 'compass',
}

const TRIP_GRADIENTS = [
  'linear-gradient(135deg, #2dd4bf 0%, #38bdf8 100%)',
  'linear-gradient(135deg, #22d3ee 0%, #818cf8 100%)',
  'linear-gradient(135deg, #34d399 0%, #2dd4bf 55%, #0ea5e9 100%)',
  'linear-gradient(135deg, #5eead4 0%, #38bdf8 55%, #6366f1 100%)',
  'linear-gradient(135deg, #67e8f9 0%, #2dd4bf 50%, #0284c7 100%)',
  'linear-gradient(135deg, #a5f3fc 0%, #22d3ee 45%, #0ea5e9 100%)',
  // Warmer, richer mesh-style variants for extra variety.
  'linear-gradient(135deg, #fb7f6f 0%, #8b7bf0 55%, #38bdf8 100%)',
  'linear-gradient(135deg, #ffab9c 0%, #fb7f6f 45%, #2dd4bf 100%)',
  'linear-gradient(135deg, #8b7bf0 0%, #38bdf8 60%, #5eead4 100%)',
]

export function randomTripGradient(seed?: string): string {
  if (!seed) return TRIP_GRADIENTS[Math.floor(Math.random() * TRIP_GRADIENTS.length)]
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return TRIP_GRADIENTS[Math.abs(h) % TRIP_GRADIENTS.length]
}

/** Days between two ISO dates (inclusive). */
export function tripDurationDays(startISO: string, endISO: string): number {
  const start = new Date(startISO + 'T00:00:00')
  const end = new Date(endISO + 'T00:00:00')
  const ms = end.getTime() - start.getTime()
  return Math.max(1, Math.floor(ms / 86_400_000) + 1)
}

/** Days from now until trip start. Negative if in progress or past. */
export function daysUntil(startISO: string): number {
  const start = new Date(startISO + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((start.getTime() - today.getTime()) / 86_400_000)
}

export type TripPhase = 'upcoming' | 'in-progress' | 'past' | 'completed'

export function tripPhase(trip: Trip): TripPhase {
  if (trip.completed) return 'completed'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(trip.startDate + 'T00:00:00')
  const end = new Date(trip.endDate + 'T00:00:00')
  if (today < start) return 'upcoming'
  if (today > end) return 'past'
  return 'in-progress'
}

/** Readiness checks before a trip can be marked complete. */
export interface TripCompletionChecks {
  packingTotal: number
  packingPacked: number
  packingSkipped: number
  packingUnresolved: number
  expenseCount: number
  packingReady: boolean
  budgetReady: boolean
  ready: boolean
}

export function getTripCompletionChecks(
  tripId: string,
  data: MeridianData,
): TripCompletionChecks {
  const packing = data.packing.filter((p) => p.tripId === tripId)
  const packingPacked = packing.filter((p) => p.status === 'packed').length
  const packingSkipped = packing.filter((p) => p.status === 'skip').length
  const packingUnresolved = packing.filter((p) => p.status === 'todo').length
  const expenseCount = data.expenses.filter((e) => e.tripId === tripId).length
  const packingReady = packingUnresolved === 0
  const budgetReady = expenseCount > 0
  return {
    packingTotal: packing.length,
    packingPacked,
    packingSkipped,
    packingUnresolved,
    expenseCount,
    packingReady,
    budgetReady,
    ready: packingReady && budgetReady,
  }
}

/** Every one of these formatters ultimately feeds user-supplied or
 * imported/shared-link ISO strings into `Date`/`Intl.DateTimeFormat`. An
 * invalid string (bad import, forged share code that slipped past
 * tripShare's own validation, hand-edited backup) throws a `RangeError`
 * from `Intl.DateTimeFormat.format` with no React error boundary nearby in
 * most call sites — so every formatter here fails soft instead. */
function safeDate(iso: string): Date | null {
  const d = new Date(iso + 'T00:00:00')
  return Number.isNaN(d.getTime()) ? null : d
}

export function formatDateRange(startISO: string, endISO: string): string {
  const start = safeDate(startISO)
  const end = safeDate(endISO)
  if (!start || !end) return 'Invalid dates'
  const sameYear = start.getFullYear() === end.getFullYear()
  const sameMonth = sameYear && start.getMonth() === end.getMonth()
  const startFmt = sameMonth
    ? new Intl.DateTimeFormat(undefined, { day: 'numeric' }).format(start)
    : new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        year: sameYear ? undefined : 'numeric',
      }).format(start)
  const endFmt = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(end)
  return `${startFmt} – ${endFmt}`
}

export function formatShortDate(iso: string): string {
  const d = safeDate(iso)
  if (!d) return 'Invalid date'
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(d)
}

export function formatDay(iso: string): string {
  const d = safeDate(iso)
  if (!d) return 'Invalid date'
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(d)
}

/** Format a Date's *local* year/month/day as `yyyy-mm-dd`. Deliberately
 * not `d.toISOString().slice(0, 10)`: that reads the UTC calendar date,
 * which is a different day from the local one for roughly half the
 * globe (anywhere with a positive UTC offset — most of Asia, Australia,
 * parts of Africa/Europe) for several hours around each local midnight.
 * A trip starting "2026-10-01" would compute Day 1 as Sep 30, "today"
 * would read as yesterday until UTC midnight caught up, etc. Every date
 * here is meant as a local wall-clock date, so extraction has to stay in
 * local time throughout. */
function isoDateLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** ISO string of yyyy-mm-dd offset from start by N days. */
export function addDays(startISO: string, days: number): string {
  const d = new Date(startISO + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return isoDateLocal(d)
}

export function todayISO(): string {
  return isoDateLocal(new Date())
}

export function makeId(prefix = 'id'): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `${prefix}_${Date.now().toString(36)}_${rand}`
}

/** `travelerCount` (a quick headcount) and `travelers` (an optional named
 * roster) are edited independently, so they can drift — someone sets
 * "4 travelers" then only names 2, or types 3 names but leaves the count
 * at the default 1. Bill-split and "paid by" already key off `travelers`
 * (names), not the count, so the honest number of people involved is
 * never *fewer* than however many are actually named — reconcile at the
 * read site rather than trusting either field alone. */
export function effectiveTravelerCount(trip: Trip): number {
  return Math.max(trip.travelerCount, trip.travelers.length, 1)
}

export function primaryDestination(trip: Trip): string {
  const first = trip.destinations[0]
  if (!first) return 'Unspecified'
  return first.country ? `${first.city}, ${first.country}` : first.city
}

export function destinationSummary(trip: Trip): string {
  if (trip.destinations.length === 0) return 'No destinations yet'
  if (trip.destinations.length === 1) return primaryDestination(trip)
  const [head, ...rest] = trip.destinations
  return `${head.city} + ${rest.length} more`
}

/** True once at least one destination has a leg date range set — the
 * signal that a trip is actually using multi-leg dates rather than just
 * happening to have several destinations logged with no particular
 * order or timing (which is still valid, just not a "leg" plan). */
export function hasTripLegs(trip: Trip): boolean {
  return trip.destinations.length > 1 && trip.destinations.some((d) => d.startDate && d.endDate)
}

/** Which destination the trip is "in" on a given day (1-indexed, same
 * convention as ItineraryEvent.day). Falls back to the first destination
 * when no leg dates are set, or when the day falls outside every leg's
 * range (a travel day between legs, or legs that don't fully cover the
 * trip) — better an approximate answer than none for a day-by-day view
 * that always needs *something* to show. */
export function destinationForDay(trip: Trip, day: number): Destination | undefined {
  if (trip.destinations.length === 0) return undefined
  if (!hasTripLegs(trip)) return trip.destinations[0]
  const dateISO = addDays(trip.startDate, day - 1)
  const match = trip.destinations.find(
    (d) => d.startDate && d.endDate && dateISO >= d.startDate && dateISO <= d.endDate,
  )
  return match ?? trip.destinations[0]
}

/** Index of the destination whose leg covers *today* — for defaulting a
 * per-destination picker (weather, toolkit) to wherever you actually are
 * right now on a multi-city trip, instead of always the first city
 * added. Falls back to 0 outside any leg's range, or when there are no
 * leg dates at all. */
export function currentLegIndex(trip: Trip): number {
  if (!hasTripLegs(trip)) return 0
  const today = todayISO()
  const idx = trip.destinations.findIndex(
    (d) => d.startDate && d.endDate && today >= d.startDate && today <= d.endDate,
  )
  return idx >= 0 ? idx : 0
}
