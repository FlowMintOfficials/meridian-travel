import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon, type IconName } from './Icon'
import { tripPhase } from '../lib/tripHelpers'
import type { Trip, ViewId } from '../types'

interface SideNavProps {
  view: ViewId
  trips: Trip[]
  activeTripId: string | null
  theme: 'dark' | 'light'
  open: boolean
  onClose: () => void
  onNavigate: (view: ViewId) => void
  onOpenTrip: (id: string) => void
  onToggleTheme: () => void
}

interface NavEntry {
  id: ViewId
  label: string
  icon: IconName
  hint: string
}

const NAV: NavEntry[] = [
  { id: 'trips', label: 'Trips', icon: 'suitcase', hint: 'All your journeys' },
  { id: 'settings', label: 'Settings', icon: 'settings', hint: 'Preferences & data' },
  { id: 'help', label: 'Help', icon: 'helpCircle', hint: 'Guide & FAQ' },
]

const QUICK_LIMIT = 4

export function SideNav({
  view,
  trips,
  activeTripId,
  theme,
  open,
  onClose,
  onNavigate,
  onOpenTrip,
  onToggleTheme,
}: SideNavProps) {
  const activeView = view === 'trip' ? 'trips' : view

  // Below 960px the drawer is off-canvas (translated out of view) unless
  // `open` — but purely CSS-driven, so a keyboard/screen-reader user could
  // still tab into its (invisible) buttons. Match the same breakpoint in
  // JS so `inert` only applies when it's genuinely off-screen: above it,
  // the rail is always visible regardless of `open` and must stay usable.
  const [isNarrow, setIsNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 960px)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 960px)')
    const onChange = () => setIsNarrow(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  const offscreen = isNarrow && !open

  // Focus the close button when the drawer opens (mobile hamburger tap)
  // — otherwise focus stays on the now-hidden-behind-scrim trigger with no
  // indication where it went. Escape closes it, matching Dialog's own
  // convention for dismissible overlays.
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const wasOpenRef = useRef(false)
  useEffect(() => {
    if (open && !wasOpenRef.current) closeBtnRef.current?.focus()
    wasOpenRef.current = open
  }, [open])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Whatever's most relevant right now — on the road first, then what's
  // coming up next — so switching trips never requires a trip back to a
  // list page first.
  const visibleTrips = useMemo(() => trips.filter((t) => !t.archived), [trips])
  const quickTrips = useMemo(() => {
    const rank = (t: Trip) => {
      const phase = tripPhase(t)
      return phase === 'in-progress' ? 0 : phase === 'upcoming' ? 1 : 2
    }
    return [...visibleTrips]
      .sort((a, b) => {
        const diff = rank(a) - rank(b)
        if (diff !== 0) return diff
        // Within the same phase, order by actual chronology rather than
        // edit recency — a trip starting in 10 days is more "next" than
        // one starting in 40 days regardless of which was touched last.
        const phase = tripPhase(a)
        if (phase === 'past' || phase === 'completed') {
          return b.endDate.localeCompare(a.endDate)
        }
        return a.startDate.localeCompare(b.startDate)
      })
      .slice(0, QUICK_LIMIT)
  }, [visibleTrips])

  return (
    <>
      {open && <div className="side-scrim" onClick={onClose} aria-hidden />}
      <aside
        className={`app-side ${open ? 'open' : ''}`}
        aria-label="Primary navigation"
        inert={offscreen ? true : undefined}
      >
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            <Icon name="compass" size={22} />
          </span>
          <div className="brand-copy">
            <strong>Meridian</strong>
            <small>Travel companion</small>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            className="side-close"
            onClick={onClose}
            aria-label="Close navigation"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <nav className="app-nav">
          <button
            type="button"
            className={`nav-item ${activeView === 'trips' && !activeTripId ? 'active' : ''}`}
            onClick={() => {
              onNavigate('trips')
              onClose()
            }}
          >
            <Icon name={NAV[0].icon} size={17} />
            <span className="nav-item-label">{NAV[0].label}</span>
            {visibleTrips.length > 0 && (
              <span className="nav-count mono">{visibleTrips.length}</span>
            )}
          </button>

          {quickTrips.length > 0 && (
            <div className="nav-trips" role="group" aria-label="Quick switch trips">
              {quickTrips.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`nav-trip ${activeTripId === t.id ? 'active' : ''}`}
                  onClick={() => {
                    onOpenTrip(t.id)
                    onClose()
                  }}
                  title={t.name}
                >
                  <span
                    className="nav-trip-swatch"
                    style={{ background: t.coverGradient ?? 'var(--sunset)' }}
                    aria-hidden
                  />
                  <span className="nav-trip-name">{t.name}</span>
                </button>
              ))}
              {visibleTrips.length > quickTrips.length && (
                <button
                  type="button"
                  className="nav-trip nav-trip-more"
                  onClick={() => {
                    onNavigate('trips')
                    onClose()
                  }}
                >
                  View all {visibleTrips.length}
                </button>
              )}
            </div>
          )}

          {NAV.slice(1).map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={`nav-item ${activeView === entry.id ? 'active' : ''}`}
              onClick={() => {
                onNavigate(entry.id)
                onClose()
              }}
            >
              <Icon name={entry.icon} size={17} />
              <span className="nav-item-label">{entry.label}</span>
            </button>
          ))}
        </nav>

        <div className="app-side-foot">
          <button type="button" className="foot-btn" onClick={onToggleTheme}>
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </div>
      </aside>
    </>
  )
}
