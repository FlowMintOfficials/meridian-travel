import { useMemo, useState } from 'react'
import { Icon } from './Icon'
import { TripCard } from './TripCard'
import { TripRow } from './TripRow'
import { EmptyState } from './EmptyState'
import { daysUntil, destinationSummary, tripPhase } from '../lib/tripHelpers'
import type { Trip, MeridianData } from '../types'

type TripFilter = 'all' | 'upcoming' | 'in-progress' | 'past' | 'archived'
type ViewMode = 'grid' | 'list'

const VIEW_MODE_KEY = 'meridian:trips-view-mode'

interface TripsViewProps {
  data: MeridianData
  onOpenTrip: (id: string) => void
  onCreateTrip: () => void
  onImportSharedTrip: () => void
}

export function TripsView({ data, onOpenTrip, onCreateTrip, onImportSharedTrip }: TripsViewProps) {
  const [filter, setFilter] = useState<TripFilter>('all')
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem(VIEW_MODE_KEY)
    return saved === 'list' ? 'list' : 'grid'
  })

  const setAndPersistViewMode = (mode: ViewMode) => {
    setViewMode(mode)
    localStorage.setItem(VIEW_MODE_KEY, mode)
  }

  const grouped = useMemo(() => groupTrips(data.trips), [data.trips])

  const visibleTrips = useMemo(() => {
    if (filter === 'archived') return grouped.archived
    if (filter === 'upcoming') return grouped.upcoming
    if (filter === 'in-progress') return grouped.inProgress
    if (filter === 'past') return grouped.past
    return [...grouped.inProgress, ...grouped.upcoming, ...grouped.past]
  }, [filter, grouped])

  const packingByTrip = useMemo(() => {
    const map = new Map<string, { packed: number; total: number }>()
    for (const item of data.packing) {
      const bucket = map.get(item.tripId) ?? { packed: 0, total: 0 }
      bucket.total += 1
      if (item.status === 'packed') bucket.packed += 1
      map.set(item.tripId, bucket)
    }
    return map
  }, [data.packing])

  const itineraryByTrip = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of data.itinerary) map.set(e.tripId, (map.get(e.tripId) ?? 0) + 1)
    return map
  }, [data.itinerary])

  const expensesByTrip = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of data.expenses) map.set(e.tripId, (map.get(e.tripId) ?? 0) + 1)
    return map
  }, [data.expenses])

  if (data.trips.length === 0) {
    return (
      <div className="view">
        <div className="view-lead">
          <p className="eyebrow">Meridian</p>
          <h1>Welcome aboard.</h1>
          <p>
            A private, offline-first travel companion for packing, day-by-day itineraries,
            and multi-currency expenses — everything encrypted on this device, no accounts.
          </p>
        </div>
        <EmptyState
          icon="plane"
          title="No trips yet"
          description="Plan your next one and Meridian will suggest a smart packing list, forecast the weather, and pre-set the local currency."
          action={
            <button type="button" className="btn btn-primary" onClick={onCreateTrip}>
              <Icon name="plus" size={15} /> Plan a trip
            </button>
          }
        />
      </div>
    )
  }

  // Every in-progress trip is equally "right now" -- singling out just the
  // first one for the big hero treatment while an equally-active sibling
  // gets demoted to a plain grid card read as arbitrary and inconsistent.
  // So: 2+ in-progress trips all get the same hero-style card, side by
  // side. Only when there's a single standout (one in-progress trip, or
  // none and just the soonest upcoming one) does the classic hero + "coming
  // up" side panel apply -- that framing only makes sense for a singular
  // "the one trip that matters most right now."
  const nowTrips = grouped.inProgress
  const showNowGrid = nowTrips.length > 1
  const singleFeatured = showNowGrid ? null : nowTrips[0] ?? grouped.upcoming[0] ?? null

  const featuredIds = new Set(
    showNowGrid ? nowTrips.map((t) => t.id) : singleFeatured ? [singleFeatured.id] : [],
  )

  // Whatever else is imminent -- this used to require scrolling past the
  // hero and skimming the whole grid to spot.
  const comingUp = grouped.upcoming.filter((t) => !featuredIds.has(t.id)).slice(0, 4)

  // Everything left for the "All trips" grid/list once whatever's in the
  // spotlight above is excluded -- when every visible trip is already up
  // there (e.g. exactly the trips that are all "right now"), this is
  // empty and the section below shouldn't render at all: a heading with
  // an empty grid under it reads as broken, not as "nothing more to see."
  const remainingTrips = visibleTrips.filter((t) => filter !== 'all' || !featuredIds.has(t.id))

  const totalActive = grouped.inProgress.length + grouped.upcoming.length + grouped.past.length

  const filterChips: Array<{ id: TripFilter; label: string; count: number }> = [
    { id: 'all', label: 'All', count: totalActive },
    { id: 'in-progress', label: 'Now', count: grouped.inProgress.length },
    { id: 'upcoming', label: 'Upcoming', count: grouped.upcoming.length },
    { id: 'past', label: 'Past', count: grouped.past.length },
    ...(grouped.archived.length > 0
      ? [{ id: 'archived' as TripFilter, label: 'Archived', count: grouped.archived.length }]
      : []),
  ]

  return (
    <div className="view">
      <div className="view-lead">
        <p className="eyebrow">Trips</p>
        <h1>
          {grouped.upcoming.length > 0
            ? `${grouped.upcoming.length} trip${grouped.upcoming.length !== 1 ? 's' : ''} ahead.`
            : grouped.inProgress.length > 0
              ? 'On the road.'
              : 'Ready when you are.'}
        </h1>
        <p>{totalActive} total, all on this device, all encrypted.</p>
      </div>

      <div className="trips-stats">
        <div>
          <span className="mono">{totalActive}</span>
          <small>Total</small>
        </div>
        <div>
          <span className="mono">{grouped.inProgress.length}</span>
          <small>Now</small>
        </div>
        <div>
          <span className="mono">{grouped.upcoming.length}</span>
          <small>Upcoming</small>
        </div>
        <div>
          <span className="mono">{grouped.past.length}</span>
          <small>Past</small>
        </div>
      </div>

      <div className="trip-toolbar">
        <div
          className="filter-row"
          role="tablist"
          aria-label="Filter trips"
          onKeyDown={(e) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return
            e.preventDefault()
            const i = filterChips.findIndex((f) => f.id === filter)
            const next =
              e.key === 'Home'
                ? 0
                : e.key === 'End'
                  ? filterChips.length - 1
                  : e.key === 'ArrowRight'
                    ? (i + 1) % filterChips.length
                    : (i - 1 + filterChips.length) % filterChips.length
            setFilter(filterChips[next].id)
            document.getElementById(`trip-filter-${filterChips[next].id}`)?.focus()
          }}
        >
          {filterChips.map((chip) => (
            <FilterChip
              key={chip.id}
              id={`trip-filter-${chip.id}`}
              active={filter === chip.id}
              onClick={() => setFilter(chip.id)}
              label={chip.label}
              count={chip.count}
            />
          ))}
        </div>
        <div className="trip-toolbar-actions">
          {/* Grid/list only changes the "All trips" section below — when
           * every visible trip is absorbed into the spotlight/coming-up
           * panels (e.g. just a couple of trips total), that section
           * doesn't render at all, so the toggle would sit there looking
           * functional while visibly doing nothing. Hide it in that case
           * rather than leave a dead-looking control. */}
          {remainingTrips.length > 0 && (
            <div className="seg view-seg" role="group" aria-label="Trip list layout">
              <button
                type="button"
                className={viewMode === 'grid' ? 'active' : ''}
                onClick={() => setAndPersistViewMode('grid')}
                title="Grid view"
                aria-label="Grid view"
                aria-pressed={viewMode === 'grid'}
              >
                <Icon name="layoutGrid" size={14} />
              </button>
              <button
                type="button"
                className={viewMode === 'list' ? 'active' : ''}
                onClick={() => setAndPersistViewMode('list')}
                title="List view"
                aria-label="List view"
                aria-pressed={viewMode === 'list'}
              >
                <Icon name="layoutList" size={14} />
              </button>
            </div>
          )}
          <button
            type="button"
            className="btn"
            onClick={onImportSharedTrip}
            title="Import a shared trip"
          >
            <Icon name="qr" size={15} />
            <span>Import</span>
          </button>
          <button type="button" className="btn btn-primary" onClick={onCreateTrip}>
            <Icon name="plus" size={15} />
            <span>New trip</span>
          </button>
        </div>
      </div>

      {filter === 'all' && showNowGrid && (
        <>
          <div className="trips-now-grid">
            {nowTrips.map((trip) => (
              <FeaturedTrip
                key={trip.id}
                trip={trip}
                packingProgress={packingByTrip.get(trip.id) ?? { packed: 0, total: 0 }}
                itineraryCount={itineraryByTrip.get(trip.id) ?? 0}
                expenseCount={expensesByTrip.get(trip.id) ?? 0}
                onOpen={() => onOpenTrip(trip.id)}
              />
            ))}
          </div>
          {comingUp.length > 0 && (
            <div className="trips-below-now">
              <SpotlightSide trips={comingUp} onOpen={onOpenTrip} />
            </div>
          )}
        </>
      )}

      {filter === 'all' && !showNowGrid && singleFeatured && (
        <div className="trips-spotlight">
          <FeaturedTrip
            trip={singleFeatured}
            packingProgress={packingByTrip.get(singleFeatured.id) ?? { packed: 0, total: 0 }}
            itineraryCount={itineraryByTrip.get(singleFeatured.id) ?? 0}
            expenseCount={expensesByTrip.get(singleFeatured.id) ?? 0}
            onOpen={() => onOpenTrip(singleFeatured.id)}
          />
          <SpotlightSide trips={comingUp} onOpen={onOpenTrip} />
        </div>
      )}

      {visibleTrips.length === 0 ? (
        <EmptyState
          icon="compass"
          title="Nothing here yet"
          description={`No trips match the "${filter}" filter.`}
        />
      ) : remainingTrips.length === 0 ? null : (
        <div className="trips-all">
          {filter === 'all' && (
            <h2 className="trips-section-head">
              All trips <span className="mono">{remainingTrips.length}</span>
            </h2>
          )}
          {viewMode === 'grid' ? (
            <div className="trip-grid">
              {remainingTrips.map((trip) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  packingProgress={packingByTrip.get(trip.id) ?? { packed: 0, total: 0 }}
                  itineraryCount={itineraryByTrip.get(trip.id) ?? 0}
                  expenseCount={expensesByTrip.get(trip.id) ?? 0}
                  onOpen={onOpenTrip}
                />
              ))}
            </div>
          ) : (
            <div className="trip-list">
              {remainingTrips.map((trip) => (
                <TripRow
                  key={trip.id}
                  trip={trip}
                  packingProgress={packingByTrip.get(trip.id) ?? { packed: 0, total: 0 }}
                  itineraryCount={itineraryByTrip.get(trip.id) ?? 0}
                  expenseCount={expensesByTrip.get(trip.id) ?? 0}
                  onOpen={onOpenTrip}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function FilterChip({
  id,
  active,
  onClick,
  label,
  count,
}: {
  id: string
  active: boolean
  onClick: () => void
  label: string
  count: number
}) {
  return (
    <button
      id={id}
      type="button"
      role="tab"
      aria-selected={active}
      tabIndex={active ? 0 : -1}
      className={`filter-chip ${active ? 'active' : ''}`}
      onClick={onClick}
    >
      {label}
      <span className="filter-chip-count mono">{count}</span>
    </button>
  )
}

interface FeaturedProps {
  trip: Trip
  packingProgress: { packed: number; total: number }
  itineraryCount: number
  expenseCount: number
  onOpen: () => void
}

function FeaturedTrip({ trip, packingProgress, itineraryCount, expenseCount, onOpen }: FeaturedProps) {
  const phase = tripPhase(trip)
  return (
    <button
      type="button"
      className={`featured-trip phase-${phase}`}
      onClick={onOpen}
      style={{ background: trip.coverGradient ?? 'var(--sunset)' }}
    >
      <div className="featured-trip-veil" />
      <div className="featured-trip-content">
        <p className="featured-trip-eyebrow">
          {phase === 'in-progress'
            ? 'Right now'
            : phase === 'upcoming'
              ? 'Up next'
              : phase === 'completed'
                ? 'Completed'
                : 'Recent'}
        </p>
        <h2 className="featured-trip-title">{trip.name}</h2>
        <p className="featured-trip-sub">
          {trip.destinations.map((d) => d.city).join(' · ') || 'Add a destination'}
        </p>
        <div className="featured-trip-stats">
          <span>
            <strong className="mono">
              {packingProgress.total === 0
                ? '—'
                : `${packingProgress.packed}/${packingProgress.total}`}
            </strong>{' '}
            packed
          </span>
          <span>
            <strong className="mono">{itineraryCount}</strong> events
          </span>
          <span>
            <strong className="mono">{expenseCount}</strong> expenses
          </span>
        </div>
      </div>
      <div className="featured-trip-arrow">
        Open <Icon name="arrowRight" size={16} />
      </div>
    </button>
  )
}

// The spotlight's side panel — a short, glanceable queue of what else is
// imminent, so the top of the dashboard carries real information instead
// of one big hero card floating next to empty space.
function SpotlightSide({ trips, onOpen }: { trips: Trip[]; onOpen: (id: string) => void }) {
  return (
    <div className="trips-spotlight-side">
      <p className="trips-spotlight-side-title">Coming up</p>
      {trips.length === 0 ? (
        <p className="trips-spotlight-side-empty">
          Nothing else on the horizon — plan another trip to fill the queue.
        </p>
      ) : (
        <ul className="spotlight-list">
          {trips.map((trip) => {
            const phase = tripPhase(trip)
            const until = daysUntil(trip.startDate)
            const when =
              phase === 'in-progress'
                ? 'Now'
                : until === 0
                  ? 'Today'
                  : until === 1
                    ? 'Tomorrow'
                    : `${until}d`
            return (
              <li key={trip.id}>
                <button type="button" onClick={() => onOpen(trip.id)}>
                  <span
                    className="spotlight-swatch"
                    style={{ background: trip.coverGradient ?? 'var(--sunset)' }}
                    aria-hidden
                  />
                  <span className="spotlight-item-main">
                    <strong>{trip.name}</strong>
                    <small>{destinationSummary(trip)}</small>
                  </span>
                  <span className="spotlight-item-when mono">{when}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function groupTrips(trips: Trip[]) {
  const now: Trip[] = []
  const upcoming: Trip[] = []
  const past: Trip[] = []
  const archived: Trip[] = []
  for (const t of trips) {
    if (t.archived) {
      archived.push(t)
      continue
    }
    const phase = tripPhase(t)
    if (phase === 'in-progress') now.push(t)
    else if (phase === 'upcoming') upcoming.push(t)
    else past.push(t)
  }
  now.sort((a, b) => a.startDate.localeCompare(b.startDate))
  upcoming.sort((a, b) => a.startDate.localeCompare(b.startDate))
  past.sort((a, b) => b.endDate.localeCompare(a.endDate))
  archived.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return { inProgress: now, upcoming, past, archived }
}
