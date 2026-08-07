import { useEffect, useMemo, useState } from 'react'
import { Icon, type IconName } from './Icon'
import { WeatherPanel } from './WeatherPanel'
import {
  TRIP_TYPE_ICONS,
  TRIP_TYPE_LABELS,
  daysUntil,
  formatDateRange,
  formatShortDate,
  primaryDestination,
  todayISO,
  tripDurationDays,
  tripPhase,
} from '../lib/tripHelpers'
import { convert, currencyMeta, formatMoney, isCacheFresh } from '../lib/currency'
import { downloadTripSummary, printTripSummaryPdf } from '../lib/tripSummary'
import { timezoneLabel } from '../lib/timezone'
import type { MeridianData, Trip } from '../types'
import type { MeridianStore } from '../hooks/useMeridian'

interface TripOverviewTabProps {
  trip: Trip
  data: MeridianData
  store: MeridianStore
  onNavigateTab: (tab: TripTab) => void
  onToast: (text: string, tone?: 'default' | 'success' | 'danger' | 'info') => void
  onRequestComplete: () => void
}

type TripTab =
  | 'overview'
  | 'checklist'
  | 'packing'
  | 'itinerary'
  | 'expenses'
  | 'photos'
  | 'docs'

export function TripOverviewTab({
  trip,
  data,
  store,
  onNavigateTab,
  onToast,
  onRequestComplete,
}: TripOverviewTabProps) {
  const phase = tripPhase(trip)
  const until = daysUntil(trip.startDate)
  const duration = tripDurationDays(trip.startDate, trip.endDate)

  const packing = data.packing.filter((p) => p.tripId === trip.id)
  const packed = packing.filter((p) => p.status === 'packed').length
  const packPercent = packing.length > 0 ? Math.round((packed / packing.length) * 100) : 0

  const itinerary = data.itinerary.filter((e) => e.tripId === trip.id)
  const expenses = data.expenses.filter((e) => e.tripId === trip.id)

  const expenseTotal = useMemo(() => {
    let total = 0
    for (const e of expenses) {
      const inHome = convert(e.amount, e.currency, trip.homeCurrency, data.cachedRates)
      if (inHome != null) total += inHome
    }
    return total
  }, [expenses, trip.homeCurrency, data.cachedRates])

  // Auto-refresh rates when we open a trip so the numbers are honest.
  useEffect(() => {
    if (!isCacheFresh(data.cachedRates, trip.homeCurrency)) {
      void store.refreshRates(trip.homeCurrency)
    }
  }, [trip.homeCurrency, data.cachedRates, store])

  const [sampleAmount, setSampleAmount] = useState(100)
  const converted = convert(sampleAmount, trip.tripCurrency, trip.homeCurrency, data.cachedRates)

  const countdownLabel =
    phase === 'completed'
      ? 'Completed'
      : phase === 'upcoming'
        ? until === 0
          ? 'Starts today'
          : until === 1
            ? 'Tomorrow'
            : `In ${until} days`
        : phase === 'in-progress'
          ? 'On the road'
          : 'Wrapped'

  const handleReopen = () => {
    store.reopenTrip(trip.id)
    onToast(`"${trip.name}" reopened.`, 'info')
  }

  const handleDownloadSummary = () => {
    downloadTripSummary(trip, data)
    onToast('Trip summary downloaded.', 'success')
  }

  const handlePdf = () => {
    printTripSummaryPdf(trip, data)
    onToast('Print dialog opened — choose Save as PDF.', 'info')
  }

  const checklistTodo = data.checklist.filter(
    (c) => c.tripId === trip.id && c.status === 'todo',
  ).length
  const packingTodo = packing.filter((p) => p.status === 'todo').length
  const spentToday = expenses.filter((e) => e.date === todayISO()).length
  const showNudges = !trip.completed && (phase === 'upcoming' || phase === 'in-progress')

  const budgetTarget = trip.budgetTarget
  const overBudget =
    budgetTarget != null && budgetTarget > 0 && expenseTotal > budgetTarget

  return (
    <section className="overview-tab">
      <div className="overview-hero" style={{ background: trip.coverGradient ?? 'var(--sunset)' }}>
        <div className="overview-hero-veil" />
        <div className="overview-hero-inner">
          <span className="chip accent overview-phase-chip">
            <Icon
              name={
                phase === 'completed'
                  ? 'check'
                  : phase === 'in-progress'
                    ? 'sparkle'
                    : phase === 'upcoming'
                      ? 'clock'
                      : 'archive'
              }
              size={12}
            />
            {countdownLabel}
          </span>
          <div className="overview-hero-copy">
            <p className="overview-hero-dates mono">
              {formatDateRange(trip.startDate, trip.endDate)} · {duration} day
              {duration !== 1 && 's'}
              {trip.timezone ? ` · ${timezoneLabel(trip.timezone)}` : ''}
            </p>
            <h2>{primaryDestination(trip)}</h2>
            <p className="overview-hero-type">
              <Icon name={TRIP_TYPE_ICONS[trip.type] as IconName} size={13} />
              {TRIP_TYPE_LABELS[trip.type]}
              {trip.travelerCount > 1 && (
                <>
                  <span className="pack-dot">·</span>
                  <Icon name="users" size={13} /> {trip.travelerCount} traveler
                  {trip.travelerCount !== 1 && 's'}
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {showNudges && (packingTodo > 0 || checklistTodo > 0 || spentToday === 0) && (
        <div className="overview-nudges">
          {checklistTodo > 0 && (
            <button type="button" className="nudge" onClick={() => onNavigateTab('checklist')}>
              <Icon name="check" size={14} /> {checklistTodo} pre-trip item
              {checklistTodo !== 1 && 's'} left
            </button>
          )}
          {packingTodo > 0 && (
            <button type="button" className="nudge" onClick={() => onNavigateTab('packing')}>
              <Icon name="suitcase" size={14} /> {packingTodo} packing item
              {packingTodo !== 1 && 's'} still open
            </button>
          )}
          {phase === 'in-progress' && spentToday === 0 && (
            <button type="button" className="nudge" onClick={() => onNavigateTab('expenses')}>
              <Icon name="wallet" size={14} /> Log today’s spend
            </button>
          )}
        </div>
      )}

      <div className="overview-grid">
        <button
          type="button"
          className="overview-card link"
          onClick={() => onNavigateTab('packing')}
        >
          <div className="overview-card-head">
            <span className="overview-card-icon">
              <Icon name="suitcase" size={16} />
            </span>
            <div>
              <p className="overview-card-eyebrow">Packing</p>
              <strong>
                {packing.length === 0
                  ? 'Nothing yet'
                  : `${packed}/${packing.length} packed`}
              </strong>
            </div>
          </div>
          {packing.length > 0 && (
            <div className="overview-card-progress" aria-hidden>
              <div style={{ width: `${packPercent}%` }} />
            </div>
          )}
          <span className="overview-card-cta">
            {packing.length === 0 ? 'Start packing' : `${packPercent}% ready`}
            <Icon name="arrowRight" size={13} />
          </span>
        </button>

        <button
          type="button"
          className="overview-card link"
          onClick={() => onNavigateTab('itinerary')}
        >
          <div className="overview-card-head">
            <span className="overview-card-icon">
              <Icon name="map" size={16} />
            </span>
            <div>
              <p className="overview-card-eyebrow">Itinerary</p>
              <strong>
                {itinerary.length === 0
                  ? 'Empty'
                  : `${itinerary.length} event${itinerary.length !== 1 ? 's' : ''}`}
              </strong>
            </div>
          </div>
          {itinerary.length > 0 && (
            <p className="overview-card-hint">
              Starts {formatShortDate(trip.startDate)}
            </p>
          )}
          <span className="overview-card-cta">
            {itinerary.length === 0 ? 'Plan your days' : 'View timeline'}
            <Icon name="arrowRight" size={13} />
          </span>
        </button>

        <button
          type="button"
          className="overview-card link"
          onClick={() => onNavigateTab('expenses')}
        >
          <div className="overview-card-head">
            <span className="overview-card-icon">
              <Icon name="wallet" size={16} />
            </span>
            <div>
              <p className="overview-card-eyebrow">Spent so far</p>
              <strong className="mono">
                {expenseTotal > 0
                  ? formatMoney(expenseTotal, trip.homeCurrency, 0)
                  : formatMoney(0, trip.homeCurrency, 0)}
              </strong>
            </div>
          </div>
          <p className="overview-card-hint">
            {expenses.length === 0
              ? 'No expenses logged'
              : `${expenses.length} entr${expenses.length !== 1 ? 'ies' : 'y'}`}
            {budgetTarget != null && (
              <>
                {' '}
                · budget {formatMoney(budgetTarget, trip.homeCurrency, 0)}
                {overBudget ? ' (over)' : ''}
              </>
            )}
          </p>
          <span className="overview-card-cta">
            {expenses.length === 0 ? 'Log an expense' : 'See breakdown'}
            <Icon name="arrowRight" size={13} />
          </span>
        </button>
      </div>

      <div className="overview-panels">
        <WeatherPanel trip={trip} store={store} />

        <div className="fx-panel">
          <header className="fx-head">
            <div>
              <p className="fx-eyebrow">
                <Icon name="globe" size={12} /> Currency check
              </p>
              <strong>
                1 {currencyMeta(trip.tripCurrency).code} ={' '}
                <span className="mono">
                  {convert(1, trip.tripCurrency, trip.homeCurrency, data.cachedRates)?.toFixed(
                    4,
                  ) ?? '—'}
                </span>{' '}
                {trip.homeCurrency}
              </strong>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-icon"
              onClick={() => void store.refreshRates(trip.homeCurrency, true)}
              aria-label="Refresh rates"
              title="Refresh rates"
            >
              <Icon name="refresh" size={14} />
            </button>
          </header>

          <div className="fx-convert">
            <label className="label">
              <span>Try a conversion</span>
              <div className="fx-input-row">
                <input
                  className="input mono"
                  type="number"
                  min={0}
                  step={0.01}
                  value={sampleAmount}
                  onChange={(e) => setSampleAmount(Number(e.target.value) || 0)}
                />
                <span className="fx-tag">{trip.tripCurrency}</span>
                <span className="fx-arrow">
                  <Icon name="arrowRight" size={14} />
                </span>
                <strong className="fx-result mono">
                  {converted != null
                    ? formatMoney(converted, trip.homeCurrency)
                    : `Add rates for ${trip.homeCurrency}`}
                </strong>
              </div>
            </label>
          </div>

          {data.cachedRates && (
            <p className="fx-fresh">
              Rates from {new Date(data.cachedRates.fetchedAt).toLocaleString()} ·{' '}
              <span
                style={{
                  color: isCacheFresh(data.cachedRates, trip.homeCurrency)
                    ? 'var(--success)'
                    : 'var(--warning)',
                }}
              >
                {isCacheFresh(data.cachedRates, trip.homeCurrency) ? 'fresh' : 'stale'}
              </span>
            </p>
          )}
        </div>
      </div>

      {trip.travelers.length > 0 && (
        <div className="overview-card">
          <p className="overview-card-eyebrow">
            <Icon name="users" size={12} /> Traveling with
          </p>
          <div className="chip-row">
            {trip.travelers.map((name) => (
              <span key={name} className="chip">
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className={`trip-complete-bar ${trip.completed ? 'is-done' : ''}`}>
        {trip.completed ? (
          <>
            <div className="trip-complete-copy">
              <Icon name="check" size={18} />
              <div>
                <strong>Trip completed</strong>
                <p>
                  {trip.completedAt
                    ? `Finished ${new Date(trip.completedAt).toLocaleDateString()}`
                    : 'This trip is marked as done.'}{' '}
                  Download a full summary anytime.
                </p>
              </div>
            </div>
            <div className="trip-complete-actions">
              <button type="button" className="btn btn-primary" onClick={handleDownloadSummary}>
                <Icon name="download" size={14} /> Download HTML
              </button>
              <button type="button" className="btn" onClick={handlePdf}>
                <Icon name="print" size={14} /> Save PDF
              </button>
              <button type="button" className="btn" onClick={handleReopen}>
                <Icon name="refresh" size={14} /> Reopen
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="trip-complete-copy">
              <Icon name="sparkle" size={18} />
              <div>
                <strong>Done traveling?</strong>
                <p>
                  We’ll check packing and budget first, then unlock your downloadable
                  summary.
                </p>
              </div>
            </div>
            <button type="button" className="btn btn-primary" onClick={onRequestComplete}>
              <Icon name="check" size={14} /> Complete trip
            </button>
          </>
        )}
      </div>
    </section>
  )
}
