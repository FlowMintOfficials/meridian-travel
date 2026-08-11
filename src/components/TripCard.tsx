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

interface TripCardProps {
  trip: Trip
  packingProgress: { packed: number; total: number }
  itineraryCount: number
  expenseCount: number
  /** Takes the trip id (rather than being pre-bound) so callers rendering
   * a whole grid of these can pass one stable function instead of a fresh
   * closure per card per render — that plus `memo` below means an
   * unrelated re-render of the list doesn't re-render every card in it. */
  onOpen: (id: string) => void
}

export const TripCard = memo(function TripCard({
  trip,
  packingProgress,
  itineraryCount,
  expenseCount,
  onOpen,
}: TripCardProps) {
  const phase = tripPhase(trip)
  const until = daysUntil(trip.startDate)
  const duration = tripDurationDays(trip.startDate, trip.endDate)
  const packPct = packingProgress.total > 0
    ? Math.round((packingProgress.packed / packingProgress.total) * 100)
    : 0

  const countdown =
    phase === 'completed'
      ? 'Completed'
      : phase === 'upcoming'
        ? until === 0
          ? 'Starts today'
          : until === 1
            ? 'Tomorrow'
            : `In ${until} days`
        : phase === 'in-progress'
          ? 'Happening now'
          : `Ended ${-until - duration + 1} day${Math.abs(-until - duration + 1) !== 1 ? 's' : ''} ago`

  return (
    <button
      type="button"
      className={`trip-card phase-${phase}`}
      onClick={() => onOpen(trip.id)}
      aria-label={`Open trip ${trip.name}`}
    >
      <div
        className="trip-cover"
        style={{ background: trip.coverGradient ?? 'var(--sunset)' }}
        aria-hidden
      >
        <div className="trip-cover-veil" />
        <span className={`trip-phase-chip ${phase}`}>
          {phase === 'upcoming' && <Icon name="clock" size={12} />}
          {phase === 'in-progress' && <Icon name="sparkle" size={12} />}
          {phase === 'completed' && <Icon name="check" size={12} />}
          {phase === 'past' && <Icon name="archive" size={12} />}
          {countdown}
        </span>
        <span className="trip-type-chip">
          <Icon name={TRIP_TYPE_ICONS[trip.type] as IconName} size={12} />
          {TRIP_TYPE_LABELS[trip.type]}
        </span>
      </div>

      <div className="trip-body">
        <h3 className="trip-name">{trip.name}</h3>
        <p className="trip-meta">
          <Icon name="mapPin" size={13} /> {destinationSummary(trip)}
        </p>
        <p className="trip-meta">
          <Icon name="calendar" size={13} /> {formatDateRange(trip.startDate, trip.endDate)}
          <span className="trip-meta-dot">·</span>
          {duration} day{duration !== 1 && 's'}
        </p>

        <div className="trip-stats">
          <TripStat
            icon="suitcase"
            label="Packing"
            value={
              packingProgress.total === 0
                ? '—'
                : `${packingProgress.packed}/${packingProgress.total}`
            }
            hint={packingProgress.total > 0 ? `${packPct}% ready` : undefined}
            progress={packingProgress.total > 0 ? packPct : undefined}
          />
          <TripStat icon="map" label="Itinerary" value={String(itineraryCount)} />
          <TripStat icon="wallet" label="Expenses" value={String(expenseCount)} />
        </div>
      </div>
    </button>
  )
})

interface TripStatProps {
  icon: IconName
  label: string
  value: string
  hint?: string
  progress?: number
}

function TripStat({ icon, label, value, hint, progress }: TripStatProps) {
  return (
    <div className="trip-stat">
      <span className="trip-stat-label">
        <Icon name={icon} size={12} /> {label}
      </span>
      <span className="trip-stat-value mono">{value}</span>
      {hint && <span className="trip-stat-hint">{hint}</span>}
      {progress != null && (
        <div className="trip-stat-progress" aria-hidden>
          <div className="trip-stat-progress-fill" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  )
}
