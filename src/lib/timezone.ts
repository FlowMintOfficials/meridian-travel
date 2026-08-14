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

const CALL_HOME_DAY_START_MIN = 8 * 60 // 8:00am — rough "awake and free" heuristic
const CALL_HOME_DAY_END_MIN = 22 * 60 // 10:00pm

function minutesToClockLabel(minutes: number): string {
  const total = ((minutes % 1440) + 1440) % 1440
  const h24 = Math.floor(total / 60)
  const m = total % 60
  const ampm = h24 >= 12 ? 'PM' : 'AM'
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

export interface CallHomeWindow {
  /** Wall-clock range at the destination. */
  destStart: string
  destEnd: string
  /** The same instant, back home. */
  homeStart: string
  homeEnd: string
}

/** Windows in the day where it's simultaneously "reasonable hours"
 * (8am–10pm, a rough waking/free-time heuristic) at both the
 * destination and back home — decent times to call without waking
 * anyone up or catching them at work asleep. Can be empty (e.g. two
 * places roughly 12h apart have no such overlap at all — a text or
 * voice memo beats a call there). Based on today's UTC offset for each
 * zone; a DST transition landing mid-trip could shift results by up to
 * an hour, but this is a planning nudge, not a scheduled commitment. */
export function callHomeWindows(destTimezone: string, homeTimezone: string): CallHomeWindow[] {
  const destOffset = getUtcOffsetMinutes(destTimezone)
  const homeOffset = getUtcOffsetMinutes(homeTimezone)
  if (destOffset == null || homeOffset == null) return []
  const diff = destOffset - homeOffset // destination clock is `diff` minutes ahead of home

  // Sample the day in dest-local minutes and mark which samples fall in
  // the reasonable window at both ends, then collapse to contiguous
  // ranges. (Reasonable-hours-at-destination never wraps midnight, so
  // there's no wraparound edge case to handle across the sample loop —
  // any "on" run starts and ends strictly inside it.)
  const STEP = 15
  const stepsPerDay = 1440 / STEP
  const on: boolean[] = []
  for (let i = 0; i < stepsPerDay; i++) {
    const destMin = i * STEP
    const homeMin = destMin - diff
    const destOk = destMin >= CALL_HOME_DAY_START_MIN && destMin < CALL_HOME_DAY_END_MIN
    const homeOk =
      (((homeMin % 1440) + 1440) % 1440) >= CALL_HOME_DAY_START_MIN &&
      (((homeMin % 1440) + 1440) % 1440) < CALL_HOME_DAY_END_MIN
    on.push(destOk && homeOk)
  }

  const windows: CallHomeWindow[] = []
  let rangeStartMin: number | null = null
  for (let i = 0; i <= on.length; i++) {
    const active = i < on.length && on[i]
    if (active && rangeStartMin == null) {
      rangeStartMin = i * STEP
    } else if (!active && rangeStartMin != null) {
      const destEndMin = i * STEP
      windows.push({
        destStart: minutesToClockLabel(rangeStartMin),
        destEnd: minutesToClockLabel(destEndMin),
        homeStart: minutesToClockLabel(rangeStartMin - diff),
        homeEnd: minutesToClockLabel(destEndMin - diff),
      })
      rangeStartMin = null
    }
  }
  return windows
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
