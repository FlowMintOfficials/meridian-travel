/** Format a clock time in a trip timezone (falls back to local). */
export function formatLocalTime(
  timeHHMM: string | undefined,
  timezone: string | undefined,
  dateISO: string,
): string | null {
  if (!timeHHMM) return null
  if (!timezone) return timeHHMM

  try {
    const [hh, mm] = timeHHMM.split(':').map(Number)
    if (Number.isNaN(hh) || Number.isNaN(mm)) return timeHHMM
    // Interpret wall time as being in the trip timezone by formatting a UTC guess.
    // Build an ISO-like instant: we use a Date from local parts then format in TZ.
    const probe = new Date(`${dateISO}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`)
    // Show the trip TZ label alongside the stored wall clock (trip-local times).
    const tzShort = new Intl.DateTimeFormat(undefined, {
      timeZone: timezone,
      timeZoneName: 'short',
    })
      .formatToParts(probe)
      .find((p) => p.type === 'timeZoneName')?.value
    return tzShort ? `${timeHHMM} ${tzShort}` : timeHHMM
  } catch {
    return timeHHMM
  }
}

export function timezoneLabel(timezone: string | undefined): string | null {
  if (!timezone) return null
  try {
    const parts = new Intl.DateTimeFormat(undefined, {
      timeZone: timezone,
      timeZoneName: 'short',
    }).formatToParts(new Date())
    const name = parts.find((p) => p.type === 'timeZoneName')?.value
    return name ? `${timezone} (${name})` : timezone
  } catch {
    return timezone
  }
}

/** UTC offset in minutes for a given IANA timezone at a given instant
 * (offsets shift with DST, so this is always computed for "now" or a
 * specific date rather than cached). Returns null if the timezone string
 * isn't recognized. */
export function getUtcOffsetMinutes(timezone: string, date: Date = new Date()): number | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'longOffset',
    }).formatToParts(date)
    const offsetPart = parts.find((p) => p.type === 'timeZoneName')?.value
    if (!offsetPart) return null
    if (offsetPart === 'GMT') return 0
    const match = offsetPart.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/)
    if (!match) return null
    const sign = match[1] === '-' ? -1 : 1
    const hours = parseInt(match[2], 10)
    const minutes = match[3] ? parseInt(match[3], 10) : 0
    return sign * (hours * 60 + minutes)
  } catch {
    return null
  }
}

/** Hours the destination is ahead (+) or behind (-) the home timezone. */
export function timezoneDifferenceHours(
  destTimezone: string,
  homeTimezone: string,
  date: Date = new Date(),
): number | null {
  const destOffset = getUtcOffsetMinutes(destTimezone, date)
  const homeOffset = getUtcOffsetMinutes(homeTimezone, date)
  if (destOffset == null || homeOffset == null) return null
  return (destOffset - homeOffset) / 60
}

/** Simple, general jet-lag guidance — not medical advice, just the
 * standard "shift gradually, chase morning light" rule of thumb. */
export function jetLagAdvice(hoursDiff: number): string {
  const abs = Math.abs(hoursDiff)
  if (abs < 1.5) {
    return "Small enough time difference that jet lag shouldn't be much of an issue."
  }
  const direction = hoursDiff > 0 ? 'ahead of' : 'behind'
  const shiftDays = Math.min(5, Math.max(1, Math.round(abs / 1.5)))
  return `Destination is ${abs.toFixed(0)}h ${direction} home. In the days before you leave, try shifting your sleep/wake time by about an hour a day (${shiftDays} day${shiftDays !== 1 ? 's' : ''} total) toward the destination's schedule, and get daylight exposure at the new local morning once you land.`
}

/** Common IANA zones for the create-trip picker. */
export const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Istanbul',
  'Africa/Cairo',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
  'Pacific/Auckland',
]
