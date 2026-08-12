import { useEffect, useState } from 'react'
import { Icon } from './Icon'
import { summarizeForecast, weatherLabel } from '../lib/weather'
import { currentLegIndex } from '../lib/tripHelpers'
import type { CachedWeather, Trip } from '../types'
import type { MeridianStore } from '../hooks/useMeridian'

interface WeatherPanelProps {
  trip: Trip
  store: MeridianStore
}

export function WeatherPanel({ trip, store }: WeatherPanelProps) {
  const [forecast, setForecast] = useState<CachedWeather | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Defaults to whichever leg's dates cover today, for a multi-city trip
  // with per-destination dates set — otherwise just the first (only, in
  // the common case) destination, same as before this existed.
  const [destIndex, setDestIndex] = useState(() => currentLegIndex(trip))

  const dest = trip.destinations[destIndex] ?? trip.destinations[0]
  const hasCoords = dest && dest.latitude != null && dest.longitude != null

  useEffect(() => {
    if (!hasCoords) return
    let alive = true
    setLoading(true)
    setError(null)
    void store.refreshWeatherForTrip(trip.id, destIndex).then((data) => {
      if (!alive) return
      setForecast(data ?? null)
      setLoading(false)
      if (!data) setError("Couldn't load a forecast for these dates.")
    })
    return () => {
      alive = false
    }
  }, [trip.id, destIndex, hasCoords, store])

  if (trip.destinations.length === 0) {
    return (
      <div className="wx-panel wx-empty">
        <Icon name="mapPin" size={16} />
        <span>Add a destination to see the forecast.</span>
      </div>
    )
  }

  const picker = trip.destinations.length > 1 && (
    <div className="wx-dest-picker" role="tablist" aria-label="Destination">
      {trip.destinations.map((d, i) => (
        <button
          key={`${d.city}-${i}`}
          type="button"
          className={`filter-chip ${destIndex === i ? 'active' : ''}`}
          onClick={() => setDestIndex(i)}
        >
          {d.city}
        </button>
      ))}
    </div>
  )

  if (!hasCoords) {
    return (
      <div className="wx-panel wx-empty">
        {picker}
        <Icon name="mapPin" size={16} />
        <span>No coordinates for {dest?.city ?? 'this destination'} — re-add it via search.</span>
      </div>
    )
  }

  if (loading && !forecast) {
    return (
      <div className="wx-panel wx-loading">
        {picker}
        <span className="dest-loading" aria-hidden />
        <span>Fetching forecast for {dest.city}…</span>
      </div>
    )
  }

  if (error && !forecast) {
    return (
      <div className="wx-panel wx-empty">
        {picker}
        <Icon name="cloud" size={16} />
        <span>{error}</span>
      </div>
    )
  }

  if (!forecast) return null

  const summary = summarizeForecast(forecast)

  return (
    <div className="wx-panel">
      {picker}
      <header className="wx-head">
        <div>
          <p className="wx-eyebrow">
            <Icon name="cloud" size={12} /> Forecast · {dest.city}
          </p>
          <strong className="wx-summary">{summary}</strong>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          onClick={() => void store.refreshWeatherForTrip(trip.id, destIndex)}
          aria-label="Refresh forecast"
        >
          <Icon name="refresh" size={14} />
        </button>
      </header>

      <ul className="wx-days">
        {forecast.daily.slice(0, 7).map((d) => (
          <li key={d.date}>
            <span className="wx-day-name">
              {new Date(d.date + 'T00:00:00').toLocaleDateString(undefined, {
                weekday: 'short',
              })}
            </span>
            <span className="wx-day-icon" title={weatherLabel(d.weatherCode)}>
              {weatherIcon(d.weatherCode)}
            </span>
            <span className="wx-day-temp mono">
              {Math.round(d.tempMax)}° / {Math.round(d.tempMin)}°
            </span>
            {d.precipitationMm > 0.5 && (
              <span className="wx-day-rain">
                <Icon name="droplet" size={11} /> {Math.round(d.precipitationMm)}mm
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function weatherIcon(code: number): string {
  if (code === 0) return '☀️'
  if (code <= 2) return '⛅'
  if (code <= 3) return '☁️'
  if (code <= 48) return '🌫️'
  if (code <= 57) return '🌦️'
  if (code <= 67) return '🌧️'
  if (code <= 77) return '❄️'
  if (code <= 82) return '🌧️'
  if (code <= 86) return '🌨️'
  return '⛈️'
}
