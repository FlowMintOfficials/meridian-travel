import type { MeridianData, Trip, TripType } from '../types'

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

export function formatDateRange(startISO: string, endISO: string): string {
  const start = new Date(startISO + 'T00:00:00')
  const end = new Date(endISO + 'T00:00:00')
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
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(iso + 'T00:00:00'))
}

export function formatDay(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date(iso + 'T00:00:00'))
}

/** ISO string of yyyy-mm-dd offset from start by N days. */
export function addDays(startISO: string, days: number): string {
  const d = new Date(startISO + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function todayISO(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

export function makeId(prefix = 'id'): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `${prefix}_${Date.now().toString(36)}_${rand}`
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
