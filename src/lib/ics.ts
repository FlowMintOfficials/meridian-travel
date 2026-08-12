import { formatMoney } from './currency'
import { addDays } from './tripHelpers'
import type { ItineraryEvent, ItineraryEventType, Trip } from '../types'

/**
 * Minimal, dependency-free .ics (RFC 5545) generator for itinerary events.
 *
 * Deliberately doesn't emit a VTIMEZONE block for trips with a timezone
 * set — every mainstream calendar client (Google, Apple, Outlook
 * web/365) resolves `DTSTART;TZID=<IANA name>` directly against its own
 * built-in tz database, and hand-generating historical DST-transition
 * rules for arbitrary zones is a lot of code for something those
 * clients already handle. Events with no time set become all-day.
 */

const EVENT_TYPE_LABELS: Record<ItineraryEventType, string> = {
  transport: 'Transport',
  flight: 'Flight',
  train: 'Train',
  lodging: 'Lodging',
  food: 'Food',
  activity: 'Activity',
  landmark: 'Landmark',
  note: 'Note',
}

/** Escape TEXT-valued properties per RFC 5545 §3.3.11 — backslash,
 * semicolon, comma, and literal newlines (represented as `\n`, not a
 * real CRLF, which would otherwise be read as the start of a new
 * property line). */
function escapeText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

/** Fold lines over ~75 characters with a CRLF + single-space
 * continuation (RFC 5545 §3.1) — approximate (character count, not
 * strict UTF-8 octets), but our content is overwhelmingly ASCII and
 * some strict parsers (older Outlook) reject unfolded long lines
 * outright, so it's worth doing even approximately. */
function foldLine(line: string): string {
  if (line.length <= 75) return line
  let out = ''
  let i = 0
  let first = true
  while (i < line.length) {
    const chunkLen = first ? 75 : 74 // continuation lines lose one column to the leading space
    out += (first ? '' : '\r\n ') + line.slice(i, i + chunkLen)
    i += chunkLen
    first = false
  }
  return out
}

function icsDate(dateISO: string, timeHHMM?: string): string {
  const compact = dateISO.replace(/-/g, '')
  if (!timeHHMM) return compact
  return `${compact}T${timeHHMM.replace(':', '')}00`
}

function icsTimestamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function buildDescription(trip: Trip, event: ItineraryEvent): string {
  const parts: string[] = [EVENT_TYPE_LABELS[event.type] ?? 'Activity']
  if (event.carrier || event.flightNumber) {
    parts.push([event.carrier, event.flightNumber].filter(Boolean).join(' '))
  }
  if (event.departureStation || event.arrivalStation) {
    parts.push([event.departureStation, event.arrivalStation].filter(Boolean).join(' → '))
  }
  if (event.terminal) parts.push(`Terminal ${event.terminal}`)
  if (event.gate) parts.push(`Gate ${event.gate}`)
  if (event.seat) parts.push(`Seat ${event.seat}`)
  if (event.bookingRef) parts.push(`Ref: ${event.bookingRef}`)
  if (event.cost != null) parts.push(formatMoney(event.cost, event.costCurrency ?? trip.tripCurrency))
  if (event.notes) parts.push(event.notes)
  return parts.join('\n')
}

function buildVevent(trip: Trip, event: ItineraryEvent, dtstamp: string): string {
  const dateISO = addDays(trip.startDate, event.day - 1)
  const lines: string[] = ['BEGIN:VEVENT', `UID:${event.id}@meridian.app`, `DTSTAMP:${dtstamp}`]

  if (event.startTime) {
    // An end time earlier than the start time reads as "past midnight" —
    // the data model has no separate end-day field, so this is a guess,
    // but it beats emitting a DTEND before DTSTART, which some clients
    // reject outright.
    const endDateISO =
      event.endTime && event.endTime < event.startTime ? addDays(dateISO, 1) : dateISO
    const endTime = event.endTime || event.startTime
    if (trip.timezone) {
      lines.push(`DTSTART;TZID=${trip.timezone}:${icsDate(dateISO, event.startTime)}`)
      lines.push(`DTEND;TZID=${trip.timezone}:${icsDate(endDateISO, endTime)}`)
    } else {
      lines.push(`DTSTART:${icsDate(dateISO, event.startTime)}`)
      lines.push(`DTEND:${icsDate(endDateISO, endTime)}`)
    }
  } else {
    lines.push(`DTSTART;VALUE=DATE:${icsDate(dateISO)}`)
    lines.push(`DTEND;VALUE=DATE:${icsDate(addDays(dateISO, 1))}`)
  }

  lines.push(`SUMMARY:${escapeText(event.title)}`)
  if (event.address) lines.push(`LOCATION:${escapeText(event.address)}`)
  lines.push(`DESCRIPTION:${escapeText(buildDescription(trip, event))}`)
  if (event.bookingUrl) lines.push(`URL:${event.bookingUrl}`)
  lines.push(`CATEGORIES:${escapeText(EVENT_TYPE_LABELS[event.type] ?? 'Activity')}`)
  lines.push('END:VEVENT')

  return lines.map(foldLine).join('\r\n')
}

/** One VCALENDAR containing every given event — the whole-trip export. */
export function buildIcsCalendar(trip: Trip, events: ItineraryEvent[]): string {
  const dtstamp = icsTimestamp(new Date())
  const veventBlocks = events
    .slice()
    .sort((a, b) => a.day - b.day || (a.startTime ?? '').localeCompare(b.startTime ?? ''))
    .map((e) => buildVevent(trip, e, dtstamp))

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Meridian//Trip Itinerary//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    foldLine(`X-WR-CALNAME:${escapeText(trip.name)}`),
    ...veventBlocks,
    'END:VCALENDAR',
  ]
  return lines.join('\r\n') + '\r\n'
}

/** A single event wrapped in its own VCALENDAR — for a one-off "add this
 * to my calendar" action instead of the whole itinerary. */
export function buildIcsEvent(trip: Trip, event: ItineraryEvent): string {
  return buildIcsCalendar(trip, [event])
}

export function downloadIcs(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Filesystem-safe slug, same rule tripSummary.ts uses for its downloads. */
export function icsFileName(name: string): string {
  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || 'trip'
  return `${slug}.ics`
}
