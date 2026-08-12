import { memo } from 'react'
import { Icon, type IconName } from './Icon'
import {
  TRIP_TYPE_ICONS,
  TRIP_TYPE_LABELS,
  daysUntil,
  destinationSummary,
  formatDateRange,
  tripDurationDays,
  tripPhase,
} from '../lib/tripHelpers'
import type { Trip } from '../types'

interface TripRowProps {
  trip: Trip
  packingProgress: { packed: number; total: number }
  itineraryCount: number
  expenseCount: number
  /** Takes the trip id rather than being pre-bound — see TripCard for why. */
  onOpen: (id: string) => void
}

// A dense, scan-friendly alternative to the trip card grid — one line per
// trip instead of a whole tile, for people who'd rather skim a long trip
// history than page through cards.
export const TripRow = memo(function TripRow({
  trip,
  packingProgress,
  itineraryCount,
  expenseCount,
  onOpen,
}: TripRowProps) {
  const phase = tripPhase(trip)
  const until = daysUntil(trip.startDate)
  const duration = tripDurationDays(trip.startDate, trip.endDate)

  const countdown =
    phase === 'completed'
      ? 'Completed'
      : phase === 'upcoming'
        ? until === 0
          ? 'Starts today'
          : until === 1
            ? 'Tomorrow'
            : `In ${until}d`
        : phase === 'in-progress'
          ? 'Now'
          : `Ended ${-until - duration + 1}d ago`

  return (
    <button
      type="button"
      className={`trip-row phase-${phase}`}
      onClick={() => onOpen(trip.id)}
      aria-label={`Open trip ${trip.name}`}
    >
      <span
        className="trip-row-swatch"
        style={{ background: trip.coverGradient ?? 'var(--sunset)' }}
        aria-hidden
      />
      <span className="trip-row-main">
        <span className="trip-row-name">{trip.name}</span>
        <span className="trip-row-meta">
          <Icon name="mapPin" size={12} /> {destinationSummary(trip)}
          <span className="pack-dot">·</span>
          <Icon name={TRIP_TYPE_ICONS[trip.type] as IconName} size={12} />
          {TRIP_TYPE_LABELS[trip.type]}
        </span>
      </span>
      <span className="trip-row-dates mono">{formatDateRange(trip.startDate, trip.endDate)}</span>
      <span className="trip-row-stats">
        <span title="Packing">
          <Icon name="suitcase" size={13} />
          {packingProgress.total === 0 ? '—' : `${packingProgress.packed}/${packingProgress.total}`}
        </span>
        <span title="Itinerary events">
          <Icon name="map" size={13} /> {itineraryCount}
        </span>
        <span title="Expenses logged">
          <Icon name="wallet" size={13} /> {expenseCount}
        </span>
      </span>
      <span className={`trip-row-phase phase-${phase}`}>{countdown}</span>
      <Icon name="chevronRight" size={16} className="trip-row-arrow" />
    </button>
  )
})
