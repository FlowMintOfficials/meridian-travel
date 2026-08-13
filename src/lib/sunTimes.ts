/**
 * Sunrise, sunset, golden hour, and blue hour — computed entirely on
 * device from latitude/longitude/date using the classic "Sunrise
 * Equation" (the same public-domain almanac algorithm behind most
 * lightweight sunrise/sunset calculators; see e.g.
 * edwilliams.org/sunrise_sunset_algorithm.html). No API, no network,
 * works fully offline — exactly the destinations already have
 * coordinates for (from geocoding at trip-creation time), so this is
 * free once you have those.
 *
 * Golden/blue hour boundaries use commonly-cited solar elevation angles
 * for photography (not a universal standard — different guides use
 * slightly different thresholds):
 *   - Sunrise/sunset: elevation 0° (zenith 90.833°, incl. refraction)
 *   - Golden hour ends/starts: elevation 6° (zenith 84°)
 *   - Blue hour: civil twilight, elevation -6° to 0° (zenith 90.833–96°)
 */

const DEG = Math.PI / 180
const ZENITH_SUN = 90.833 // sunrise/sunset, incl. atmospheric refraction + solar radius
const ZENITH_GOLDEN = 84 // sun at +6° elevation
const ZENITH_BLUE = 96 // sun at -6° elevation (civil twilight limit)

function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360
}

function dayOfYear(dateISO: string): number {
  const [y, m, d] = dateISO.split('-').map(Number)
  const start = Date.UTC(y, 0, 1)
  const day = Date.UTC(y, m - 1, d)
  return Math.floor((day - start) / 86_400_000) + 1
}

/** null (never rises — polar night) | 'always-up' (never sets — polar
 * day) | a UTC-hours number for the event, otherwise. */
type SolarEvent = number | 'polar-night' | 'polar-day'

function solarEventUTCHours(
  lat: number,
  lon: number,
  n: number,
  zenithDeg: number,
  rising: boolean,
): SolarEvent {
  const lngHour = lon / 15
  const t = rising ? n + (6 - lngHour) / 24 : n + (18 - lngHour) / 24

  const M = 0.9856 * t - 3.289
  let L = M + 1.916 * Math.sin(M * DEG) + 0.02 * Math.sin(2 * M * DEG) + 282.634
  L = normalizeDeg(L)

  let RA = Math.atan(0.91764 * Math.tan(L * DEG)) / DEG
  RA = normalizeDeg(RA)
  // RA must land in the same quadrant as L
  const lQuadrant = Math.floor(L / 90) * 90
  const raQuadrant = Math.floor(RA / 90) * 90
  RA = (RA + (lQuadrant - raQuadrant)) / 15 // → hours

  const sinDec = 0.39782 * Math.sin(L * DEG)
  const cosDec = Math.cos(Math.asin(sinDec))

  const cosH =
    (Math.cos(zenithDeg * DEG) - sinDec * Math.sin(lat * DEG)) / (cosDec * Math.cos(lat * DEG))
  // cosH > 1: the sun never climbs high enough to reach this zenith —
  // it never rises past it (polar night, from this threshold's view).
  // cosH < -1: the sun never dips below this zenith — it never sets
  // (polar day).
  if (cosH > 1) return 'polar-night'
  if (cosH < -1) return 'polar-day'

  let H = rising ? 360 - Math.acos(cosH) / DEG : Math.acos(cosH) / DEG
  H /= 15

  const T = H + RA - 0.06571 * t - 6.622
  const UT = ((T - lngHour) % 24 + 24) % 24
  return UT
}

function utcHoursToDate(dateISO: string, event: SolarEvent): Date | null {
  if (typeof event !== 'number') return null
  const base = Date.parse(`${dateISO}T00:00:00Z`)
  return new Date(base + event * 3_600_000)
}

export interface SunTimes {
  sunrise: Date | null
  sunset: Date | null
  /** Morning golden hour runs from sunrise to this. */
  goldenHourMorningEnd: Date | null
  /** Evening golden hour runs from this to sunset. */
  goldenHourEveningStart: Date | null
  /** Morning blue hour runs from this to sunrise. */
  blueHourMorningStart: Date | null
  /** Evening blue hour runs from sunset to this. */
  blueHourEveningEnd: Date | null
  /** Sun never sets on this date at this latitude (polar summer). */
  polarDay: boolean
  /** Sun never rises on this date at this latitude (polar winter). */
  polarNight: boolean
}

export function computeSunTimes(lat: number, lon: number, dateISO: string): SunTimes {
  const n = dayOfYear(dateISO)
  const sunriseEvt = solarEventUTCHours(lat, lon, n, ZENITH_SUN, true)
  const sunsetEvt = solarEventUTCHours(lat, lon, n, ZENITH_SUN, false)

  return {
    sunrise: utcHoursToDate(dateISO, sunriseEvt),
    sunset: utcHoursToDate(dateISO, sunsetEvt),
    goldenHourMorningEnd: utcHoursToDate(dateISO, solarEventUTCHours(lat, lon, n, ZENITH_GOLDEN, true)),
    goldenHourEveningStart: utcHoursToDate(
      dateISO,
      solarEventUTCHours(lat, lon, n, ZENITH_GOLDEN, false),
    ),
    blueHourMorningStart: utcHoursToDate(dateISO, solarEventUTCHours(lat, lon, n, ZENITH_BLUE, true)),
    blueHourEveningEnd: utcHoursToDate(dateISO, solarEventUTCHours(lat, lon, n, ZENITH_BLUE, false)),
    polarDay: sunriseEvt === 'polar-day' || sunsetEvt === 'polar-day',
    polarNight: sunriseEvt === 'polar-night' || sunsetEvt === 'polar-night',
  }
}

/** Format a computed instant in a given IANA timezone as `h:mm am/pm`. */
export function formatSunTime(d: Date | null, timezone: string | undefined): string {
  if (!d) return '—'
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone,
    }).format(d)
  } catch {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(d)
  }
}
