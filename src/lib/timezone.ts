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
