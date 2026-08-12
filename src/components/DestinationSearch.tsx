import { useEffect, useId, useRef, useState } from 'react'
import { Icon } from './Icon'
import { geocode, type GeocodedPlace } from '../lib/weather'

interface DestinationSearchProps {
  onSelect: (place: GeocodedPlace) => void
  placeholder?: string
  autoFocus?: boolean
}

export function DestinationSearch({
  onSelect,
  placeholder = 'City, country…',
  autoFocus,
}: DestinationSearchProps) {
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeocodedPlace[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      setLoading(false)
      setError(null)
      setOpen(false)
      return
    }

    const handle = window.setTimeout(async () => {
      abortRef.current?.abort()
      const ac = new AbortController()
      abortRef.current = ac
      setLoading(true)
      setError(null)
      try {
        const list = await geocode(query.trim(), 6, ac.signal)
        if (ac.signal.aborted) return
        setResults(list)
        setOpen(true)
        // Keep caret in the search field after async UI updates.
        inputRef.current?.focus({ preventScroll: true })
      } catch (err) {
        if (ac.signal.aborted) return
        setError('Search failed. Check your connection.')
        setResults([])
        setOpen(true)
        console.warn('[meridian] geocode failed', err)
      } finally {
        if (!ac.signal.aborted) setLoading(false)
      }
    }, 280)

    return () => {
      window.clearTimeout(handle)
      abortRef.current?.abort()
    }
  }, [query])

  const handlePick = (place: GeocodedPlace) => {
    onSelect(place)
    setQuery(`${place.city}, ${place.country}`)
    setOpen(false)
    setResults([])
  }

  return (
    <div className="dest-search">
      <div className="dest-input-wrap">
        <Icon name="mapPin" size={16} />
        <input
          ref={inputRef}
          className="input dest-input"
          type="text"
          inputMode="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          value={query}
          placeholder={placeholder}
          autoFocus={autoFocus}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (results.length > 0 || error) setOpen(true)
          }}
          onBlur={() => {
            // Delay so result mousedown/click can fire first.
            window.setTimeout(() => setOpen(false), 160)
          }}
          autoComplete="off"
          spellCheck={false}
        />
        {loading && <span className="dest-loading" aria-hidden />}
      </div>

      {open && (results.length > 0 || error) && (
        <div className="dest-results" id={listId} role="listbox">
          {error && <p className="dest-error">{error}</p>}
          {results.map((place, i) => (
            <button
              key={`${place.latitude}-${place.longitude}-${i}`}
              type="button"
              className="dest-result"
              role="option"
              // Prevent the button from stealing focus before click.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handlePick(place)}
            >
              <span className="dest-flag" aria-hidden>
                {flagFromCountryCode(place.countryCode)}
              </span>
              <span className="dest-copy">
                <strong>{place.city}</strong>
                <small>
                  {place.admin ? `${place.admin}, ` : ''}
                  {place.country}
                </small>
              </span>
              <Icon name="chevronRight" size={14} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Turn a two-letter ISO country code into its emoji flag. */
function flagFromCountryCode(code: string): string {
  if (!code || code.length !== 2) return '🌍'
  const base = 0x1f1e6
  const upper = code.toUpperCase()
  return String.fromCodePoint(
    base + upper.charCodeAt(0) - 65,
    base + upper.charCodeAt(1) - 65,
  )
}
