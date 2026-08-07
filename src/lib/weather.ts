import type { CachedWeather, WeatherTag } from '../types'

/**
 * Weather via Open-Meteo — free, no API key, generous rate limits, and
 * a genuinely good product. We use it two ways:
 *
 *  1. Get a daily min/max/precip forecast for the trip dates, shown in
 *     the trip header so users know what they're packing for.
 *  2. Derive `WeatherTag`s from the forecast (hot / cool / rain / etc.)
 *     that packing templates can filter their items on.
 *
 * Everything is cached per-destination for 6 hours and works offline
 * after the first fetch.
 */

const GEOCODE_API = 'https://geocoding-api.open-meteo.com/v1/search'
const FORECAST_API = 'https://api.open-meteo.com/v1/forecast'
const CACHE_TTL_MS = 6 * 60 * 60 * 1000

export interface GeocodedPlace {
  city: string
  country: string
  countryCode: string
  latitude: number
  longitude: number
  admin?: string
}

export async function geocode(query: string, limit = 5): Promise<GeocodedPlace[]> {
  const url = `${GEOCODE_API}?name=${encodeURIComponent(query)}&count=${limit}&language=en&format=json`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Geocode failed: ${res.status}`)
  const data = (await res.json()) as {
    results?: Array<{
      name: string
      country: string
      country_code: string
      latitude: number
      longitude: number
      admin1?: string
    }>
  }
  return (data.results ?? []).map((r) => ({
    city: r.name,
    country: r.country,
    countryCode: r.country_code,
    latitude: r.latitude,
    longitude: r.longitude,
    admin: r.admin1,
  }))
}

function cacheKey(lat: number, lon: number): string {
  return `${lat.toFixed(2)},${lon.toFixed(2)}`
}

export function findCachedWeather(
  cache: CachedWeather[],
  lat: number,
  lon: number,
): CachedWeather | undefined {
  const key = cacheKey(lat, lon)
  const hit = cache.find((c) => c.key === key)
  if (!hit) return undefined
  const age = Date.now() - new Date(hit.fetchedAt).getTime()
  return age < CACHE_TTL_MS ? hit : undefined
}

export async function fetchForecast(
  lat: number,
  lon: number,
  startDate: string,
  endDate: string,
): Promise<CachedWeather> {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code',
    timezone: 'auto',
    start_date: startDate,
    end_date: endDate,
  })
  const res = await fetch(`${FORECAST_API}?${params}`)
  if (!res.ok) throw new Error(`Forecast failed: ${res.status}`)
  const data = (await res.json()) as {
    daily?: {
      time: string[]
      temperature_2m_max: number[]
      temperature_2m_min: number[]
      precipitation_sum: number[]
      weather_code: number[]
    }
  }
  const d = data.daily
  if (!d) throw new Error('Forecast response missing "daily"')
  const daily = d.time.map((date, i) => ({
    date,
    tempMax: d.temperature_2m_max[i],
    tempMin: d.temperature_2m_min[i],
    precipitationMm: d.precipitation_sum[i],
    weatherCode: d.weather_code[i],
  }))
  return {
    key: cacheKey(lat, lon),
    latitude: lat,
    longitude: lon,
    daily,
    fetchedAt: new Date().toISOString(),
  }
}

/** Reduce a forecast down to a small set of tags used to filter packing items. */
export function tagsFromForecast(w: CachedWeather | undefined): WeatherTag[] {
  if (!w || w.daily.length === 0) return []
  const avgHi = avg(w.daily.map((d) => d.tempMax))
  const avgLo = avg(w.daily.map((d) => d.tempMin))
  const totalRain = w.daily.reduce((s, d) => s + d.precipitationMm, 0)
  const sunnyDays = w.daily.filter((d) => d.weatherCode <= 3).length
  const snowyDays = w.daily.filter((d) => d.weatherCode >= 71 && d.weatherCode <= 77).length

  const tags = new Set<WeatherTag>()
  if (avgHi >= 28) tags.add('hot')
  else if (avgHi >= 22) tags.add('warm')
  else if (avgHi >= 15) tags.add('mild')
  else if (avgHi >= 5) tags.add('cool')
  else tags.add('cold')

  if (avgLo <= 5 || snowyDays > 0) tags.add('cold')
  if (totalRain / w.daily.length >= 2) tags.add('rain')
  if (snowyDays >= 1) tags.add('snow')
  if (sunnyDays / w.daily.length >= 0.6 && avgHi >= 20) tags.add('sun')

  return Array.from(tags)
}

export function summarizeForecast(w: CachedWeather | undefined): string | null {
  if (!w || w.daily.length === 0) return null
  const hi = Math.round(Math.max(...w.daily.map((d) => d.tempMax)))
  const lo = Math.round(Math.min(...w.daily.map((d) => d.tempMin)))
  const rain = w.daily.reduce((s, d) => s + d.precipitationMm, 0)
  const rainNote = rain >= 5 ? `, ~${Math.round(rain)}mm rain` : ''
  return `${lo}° – ${hi}°C${rainNote}`
}

function avg(xs: number[]): number {
  if (xs.length === 0) return 0
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

/** WMO weather code → short human label. */
export function weatherLabel(code: number): string {
  if (code === 0) return 'Clear'
  if (code <= 3) return 'Partly cloudy'
  if (code <= 48) return 'Fog'
  if (code <= 57) return 'Drizzle'
  if (code <= 67) return 'Rain'
  if (code <= 77) return 'Snow'
  if (code <= 82) return 'Rain showers'
  if (code <= 86) return 'Snow showers'
  if (code <= 99) return 'Thunderstorm'
  return 'Unknown'
}
