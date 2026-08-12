import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Icon } from './Icon'
import { WeatherPanel } from './WeatherPanel'
import { Dialog } from './Dialog'
import {
  effectiveTravelerCount,
  formatDateRange,
  formatShortDate,
  hasTripLegs,
  todayISO,
  tripPhase,
} from '../lib/tripHelpers'
import { convert, currencyMeta, formatMoney, hasLiveRates, isCacheFresh } from '../lib/currency'
import { downloadTripSummary, printTripSummaryPdf } from '../lib/tripSummary'
import { timezoneLabel } from '../lib/timezone'
import { entryRequirementsSearchUrl, openLink } from '../lib/travelLinks'
import type { MeridianData, Trip, TravelInsurancePolicy } from '../types'
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

  // These arrays hold records for *every* trip, not just this one — worth
  // memoizing since this tab re-renders on unrelated changes (e.g. every
  // keystroke in the FX converter below) and shouldn't re-scan the whole
  // dataset each time.
  const packing = useMemo(
    () => data.packing.filter((p) => p.tripId === trip.id),
    [data.packing, trip.id],
  )
  const packed = useMemo(() => packing.filter((p) => p.status === 'packed').length, [packing])
  const packPercent = packing.length > 0 ? Math.round((packed / packing.length) * 100) : 0

  const itinerary = useMemo(
    () => data.itinerary.filter((e) => e.tripId === trip.id),
    [data.itinerary, trip.id],
  )
  const expenses = useMemo(
    () => data.expenses.filter((e) => e.tripId === trip.id),
    [data.expenses, trip.id],
  )

  const expenseTotal = useMemo(() => {
    let total = 0
    for (const e of expenses) {
      const inHome = convert(e.amount, e.currency, trip.homeCurrency, data.cachedRates)
      if (inHome != null) total += inHome
    }
    return total
  }, [expenses, trip.homeCurrency, data.cachedRates])

  // Auto-refresh rates when we open a trip so the numbers are honest. Skipped
  // entirely for currencies Frankfurter has no rates for at all (AED,
  // VND) — that fetch would just 404 on every retry.
  const ratesAvailable = hasLiveRates(trip.homeCurrency) && hasLiveRates(trip.tripCurrency)
  useEffect(() => {
    if (!hasLiveRates(trip.homeCurrency)) return
    if (!isCacheFresh(data.cachedRates, trip.homeCurrency)) {
      void store.refreshRates(trip.homeCurrency)
    }
  }, [trip.homeCurrency, data.cachedRates, store])

  const [sampleAmount, setSampleAmount] = useState(100)
  const converted = convert(sampleAmount, trip.tripCurrency, trip.homeCurrency, data.cachedRates)
  const noRateCurrencies = Array.from(
    new Set([trip.tripCurrency, trip.homeCurrency].filter((c) => !hasLiveRates(c))),
  )

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

  const checklistTodo = useMemo(
    () => data.checklist.filter((c) => c.tripId === trip.id && c.status === 'todo').length,
    [data.checklist, trip.id],
  )
  const packingTodo = useMemo(() => packing.filter((p) => p.status === 'todo').length, [packing])
  const spentToday = useMemo(() => {
    const today = todayISO()
    return expenses.filter((e) => e.date === today).length
  }, [expenses])
  const showNudges = !trip.completed && (phase === 'upcoming' || phase === 'in-progress')

  const budgetTarget = trip.budgetTarget
  const overBudget =
    budgetTarget != null && budgetTarget > 0 && expenseTotal > budgetTarget

  const policy = data.insurancePolicies.find((p) => p.tripId === trip.id) ?? null
  const [policyDialogOpen, setPolicyDialogOpen] = useState(false)

  return (
    <section className="overview-tab">
      {(trip.timezone || effectiveTravelerCount(trip) > 1) && (
        <p className="overview-tz-line">
          {trip.timezone && (
            <>
              <Icon name="clock" size={12} /> Local time zone: {timezoneLabel(trip.timezone)}
            </>
          )}
          {effectiveTravelerCount(trip) > 1 && (
            <>
              {trip.timezone && <span className="pack-dot">·</span>}
              <Icon name="users" size={12} /> {effectiveTravelerCount(trip)} travelers
            </>
          )}
        </p>
      )}

      {hasTripLegs(trip) && (
        <div className="overview-legs" aria-label="Trip legs">
          {trip.destinations.map((d, i) => (
            <div key={`${d.city}-${i}`} className="overview-leg">
              <span className="overview-leg-city">
                <Icon name="mapPin" size={12} /> {d.city}
              </span>
              {d.startDate && d.endDate && (
                <span className="overview-leg-dates mono">
                  {formatDateRange(d.startDate, d.endDate)}
                </span>
              )}
              {i < trip.destinations.length - 1 && (
                <Icon name="arrowRight" size={12} className="overview-leg-arrow" />
              )}
            </div>
          ))}
        </div>
      )}

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
              {ratesAvailable ? (
                <strong>
                  1 {currencyMeta(trip.tripCurrency).code} ={' '}
                  <span className="mono">
                    {convert(1, trip.tripCurrency, trip.homeCurrency, data.cachedRates)?.toFixed(
                      4,
                    ) ?? '—'}
                  </span>{' '}
                  {trip.homeCurrency}
                </strong>
              ) : (
                <strong>No live rates for this pair</strong>
              )}
            </div>
            {ratesAvailable && (
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                onClick={() => void store.refreshRates(trip.homeCurrency, true)}
                aria-label="Refresh rates"
                title="Refresh rates"
              >
                <Icon name="refresh" size={14} />
              </button>
            )}
          </header>

          {ratesAvailable ? (
            <>
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
            </>
          ) : (
            <p className="fx-unavailable">
              <Icon name="info" size={13} />
              {noRateCurrencies.join(' and ')}{' '}
              {noRateCurrencies.length > 1 ? "aren't" : "isn't"} an ECB reference currency, so
              live conversion isn’t available for this trip. You can still log expenses in{' '}
              {trip.tripCurrency} — they just won’t auto-convert to {trip.homeCurrency}.
            </p>
          )}
        </div>

        {trip.destinations.length > 0 && (
          <div className="entry-req-panel">
            <p className="fx-eyebrow">
              <Icon name="shield" size={12} /> Entry requirements
            </p>
            <p className="entry-req-hint">
              Rules vary by nationality and change often — Meridian doesn't track them itself,
              just points you to a live lookup for each destination.
            </p>
            <div className="chip-row">
              {trip.destinations.map((d, i) => (
                <button
                  key={`${d.country}-${i}`}
                  type="button"
                  className="entry-req-chip"
                  onClick={() => openLink(entryRequirementsSearchUrl(d.country))}
                >
                  {d.country}
                  <Icon name="arrowRight" size={12} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="overview-card">
        <div className="overview-card-eyebrow-row">
          <p className="overview-card-eyebrow">
            <Icon name="shield" size={12} /> Travel insurance
          </p>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setPolicyDialogOpen(true)}
          >
            <Icon name={policy ? 'edit' : 'plus'} size={13} />
            {policy ? 'Edit' : 'Add policy'}
          </button>
        </div>
        {policy ? (
          <div className="insurance-summary">
            <strong>{policy.provider}</strong>
            <p className="mono">{policy.policyNumber}</p>
            {policy.emergencyPhone && (
              <a className="insurance-phone" href={`tel:${policy.emergencyPhone.replace(/[^\d+]/g, '')}`}>
                <Icon name="info" size={12} /> {policy.emergencyPhone}
              </a>
            )}
            {(policy.coverageStart || policy.coverageEnd) && (
              <p className="insurance-coverage">
                Covers {policy.coverageStart ? formatShortDate(policy.coverageStart) : '—'} to{' '}
                {policy.coverageEnd ? formatShortDate(policy.coverageEnd) : '—'}
              </p>
            )}
          </div>
        ) : (
          <p className="overview-card-hint">No policy on file for this trip yet.</p>
        )}
      </div>

      {trip.notes && (
        <div className="overview-card">
          <p className="overview-card-eyebrow">
            <Icon name="fileText" size={12} /> Notes
          </p>
          <p className="overview-notes-text">{trip.notes}</p>
        </div>
      )}

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

      {policyDialogOpen && (
        <InsurancePolicyDialog
          tripId={trip.id}
          policy={policy}
          store={store}
          onToast={onToast}
          onClose={() => setPolicyDialogOpen(false)}
        />
      )}
    </section>
  )
}

function InsurancePolicyDialog({
  tripId,
  policy,
  store,
  onToast,
  onClose,
}: {
  tripId: string
  policy: TravelInsurancePolicy | null
  store: MeridianStore
  onToast: TripOverviewTabProps['onToast']
  onClose: () => void
}) {
  const [provider, setProvider] = useState(policy?.provider ?? '')
  const [policyNumber, setPolicyNumber] = useState(policy?.policyNumber ?? '')
  const [emergencyPhone, setEmergencyPhone] = useState(policy?.emergencyPhone ?? '')
  const [coverageStart, setCoverageStart] = useState(policy?.coverageStart ?? '')
  const [coverageEnd, setCoverageEnd] = useState(policy?.coverageEnd ?? '')
  const [notes, setNotes] = useState(policy?.notes ?? '')

  const canSave = provider.trim().length > 0 && policyNumber.trim().length > 0

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!canSave) return
    const input = {
      provider: provider.trim(),
      policyNumber: policyNumber.trim(),
      emergencyPhone: emergencyPhone.trim() || undefined,
      coverageStart: coverageStart || undefined,
      coverageEnd: coverageEnd || undefined,
      notes: notes.trim() || undefined,
    }
    if (policy) {
      store.updateInsurancePolicy(policy.id, input)
      onToast('Policy updated.', 'success')
    } else {
      store.addInsurancePolicy(tripId, input)
      onToast('Insurance policy added.', 'success')
    }
    onClose()
  }

  const handleDelete = () => {
    if (!policy) return
    store.deleteInsurancePolicy(policy.id)
    onToast('Policy removed.', 'info')
    onClose()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={policy ? 'Edit insurance policy' : 'Add insurance policy'}
      size="sm"
      footer={
        <div className="dialog-actions">
          {policy && (
            <button type="button" className="btn btn-ghost" onClick={handleDelete}>
              <Icon name="trash" size={14} /> Remove
            </button>
          )}
          <div className="dialog-actions-spacer" />
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="insurance-form" className="btn btn-primary" disabled={!canSave}>
            {policy ? 'Save changes' : 'Add policy'}
          </button>
        </div>
      }
    >
      <form id="insurance-form" onSubmit={handleSubmit} className="trip-form">
        <div className="row-2">
          <label className="label">
            <span>Provider</span>
            <input
              className="input"
              type="text"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              placeholder="e.g. Allianz, World Nomads"
              autoFocus
              required
            />
          </label>
          <label className="label">
            <span>Policy number</span>
            <input
              className="input mono"
              type="text"
              value={policyNumber}
              onChange={(e) => setPolicyNumber(e.target.value)}
              required
            />
          </label>
        </div>
        <label className="label">
          <span>Emergency / assistance phone</span>
          <input
            className="input"
            type="text"
            value={emergencyPhone}
            onChange={(e) => setEmergencyPhone(e.target.value)}
            placeholder="e.g. +1 800 555 0100"
          />
        </label>
        <div className="row-2">
          <label className="label">
            <span>Coverage start</span>
            <input
              className="input"
              type="date"
              value={coverageStart}
              onChange={(e) => setCoverageStart(e.target.value)}
            />
          </label>
          <label className="label">
            <span>Coverage end</span>
            <input
              className="input"
              type="date"
              value={coverageEnd}
              onChange={(e) => setCoverageEnd(e.target.value)}
              min={coverageStart || undefined}
            />
          </label>
        </div>
        <label className="label">
          <span>Notes (optional)</span>
          <textarea
            className="input textarea"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Coverage limits, claim process, policy PDF filed under Docs, ..."
          />
        </label>
      </form>
    </Dialog>
  )
}
