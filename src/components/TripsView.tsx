import { useMemo, useState } from 'react'
import { Icon } from './Icon'
import { TripCard } from './TripCard'
import { EmptyState } from './EmptyState'
import { tripPhase } from '../lib/tripHelpers'
import type { Trip, MeridianData } from '../types'

type TripFilter = 'all' | 'upcoming' | 'in-progress' | 'past' | 'archived'

interface TripsViewProps {
  data: MeridianData
  onOpenTrip: (id: string) => void
  onCreateTrip: () => void
}

export function TripsView({ data, onOpenTrip, onCreateTrip }: TripsViewProps) {
  const [filter, setFilter] = useState<TripFilter>('all')

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

  // Only in-progress or upcoming trips earn the hero treatment — a completed
  // trip being "featured" reads as if it's still relevant, so past trips
  // always render as regular cards in the grid below instead.
  const featured = grouped.inProgress[0] ?? grouped.upcoming[0] ?? null

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
        <p>
          {grouped.upcoming.length + grouped.inProgress.length + grouped.past.length} total,
          all on this device, all encrypted.
        </p>
      </div>

      <div className="trip-toolbar">
        <div className="filter-row" role="tablist">
          <FilterChip
            active={filter === 'all'}
            onClick={() => setFilter('all')}
            label="All"
            count={grouped.inProgress.length + grouped.upcoming.length + grouped.past.length}
          />
          <FilterChip
            active={filter === 'in-progress'}
            onClick={() => setFilter('in-progress')}
            label="Now"
            count={grouped.inProgress.length}
          />
          <FilterChip
            active={filter === 'upcoming'}
            onClick={() => setFilter('upcoming')}
            label="Upcoming"
            count={grouped.upcoming.length}
          />
          <FilterChip
            active={filter === 'past'}
            onClick={() => setFilter('past')}
            label="Past"
            count={grouped.past.length}
          />
          {grouped.archived.length > 0 && (
            <FilterChip
              active={filter === 'archived'}
              onClick={() => setFilter('archived')}
              label="Archived"
              count={grouped.archived.length}
            />
          )}
        </div>
        <button type="button" className="btn btn-primary" onClick={onCreateTrip}>
          <Icon name="plus" size={15} />
          <span>New trip</span>
        </button>
      </div>

      {featured && filter === 'all' && (
        <FeaturedTrip
          trip={featured}
          packingProgress={packingByTrip.get(featured.id) ?? { packed: 0, total: 0 }}
          itineraryCount={itineraryByTrip.get(featured.id) ?? 0}
          expenseCount={expensesByTrip.get(featured.id) ?? 0}
          onOpen={() => onOpenTrip(featured.id)}
        />
      )}

      {visibleTrips.length === 0 ? (
        <EmptyState
          icon="compass"
          title="Nothing here yet"
          description={`No trips match the "${filter}" filter.`}
        />
      ) : (
        <div className="trip-grid">
          {visibleTrips
            .filter((t) => t.id !== featured?.id || filter !== 'all')
            .map((trip) => (
              <TripCard
                key={trip.id}
                trip={trip}
                packingProgress={packingByTrip.get(trip.id) ?? { packed: 0, total: 0 }}
                itineraryCount={itineraryByTrip.get(trip.id) ?? 0}
                expenseCount={expensesByTrip.get(trip.id) ?? 0}
                onOpen={() => onOpenTrip(trip.id)}
              />
            ))}
        </div>
      )}
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean
  onClick: () => void
  label: string
  count: number
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
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
