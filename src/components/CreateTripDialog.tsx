import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Dialog } from './Dialog'
import { Icon } from './Icon'
import { DestinationSearch } from './DestinationSearch'
import { COMMON_CURRENCIES, hasLiveRates } from '../lib/currency'
import { COMMON_TIMEZONES } from '../lib/timezone'
import { TRIP_TYPE_ICONS, TRIP_TYPE_LABELS, addDays, todayISO } from '../lib/tripHelpers'
import type { Destination, Trip, TripType } from '../types'
import type { IconName } from './Icon'

export interface TripFormValue {
  name: string
  type: TripType
  startDate: string
  endDate: string
  homeCurrency: string
  tripCurrency: string
  destinations: Destination[]
  travelerCount: number
  travelers: string[]
  budgetTarget?: number
  timezone?: string
  notes?: string
}

interface CreateTripDialogProps {
  open: boolean
  onClose: () => void
  defaultHomeCurrency: string
  /** Pass a trip to switch the dialog into edit mode, pre-filled from it. */
  existing?: Trip | null
  onCreate?: (input: TripFormValue) => void
  onSave?: (id: string, input: TripFormValue) => void
}

const TRIP_TYPES: TripType[] = [
  'general',
  'beach',
  'business',
  'city',
  'camping',
  'ski',
  'roadtrip',
  'family',
]

/** Best-guess currency for the top destinations. Not exhaustive — it's
 * a helpful default the user can override in one click. */
const COUNTRY_CURRENCY: Record<string, string> = {
  US: 'USD', CA: 'CAD', MX: 'MXN', BR: 'BRL',
  GB: 'GBP', IE: 'EUR', FR: 'EUR', DE: 'EUR', IT: 'EUR', ES: 'EUR', PT: 'EUR',
  NL: 'EUR', BE: 'EUR', AT: 'EUR', GR: 'EUR', FI: 'EUR', LU: 'EUR',
  CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK', PL: 'PLN', CZ: 'CZK', TR: 'TRY',
  JP: 'JPY', CN: 'CNY', HK: 'HKD', SG: 'SGD', KR: 'KRW',
  TH: 'THB', MY: 'MYR', ID: 'IDR', PH: 'PHP', VN: 'VND',
  IN: 'INR', AE: 'AED', ZA: 'ZAR',
  AU: 'AUD', NZ: 'NZD',
}

export function CreateTripDialog({
  open,
  onClose,
  defaultHomeCurrency,
  existing,
  onCreate,
  onSave,
}: CreateTripDialogProps) {
  const [name, setName] = useState('')
  const [type, setType] = useState<TripType>('general')
  const [startDate, setStartDate] = useState(todayISO())
  const [endDate, setEndDate] = useState(addDays(todayISO(), 6))
  const [homeCurrency, setHomeCurrency] = useState(defaultHomeCurrency)
  const [tripCurrency, setTripCurrency] = useState(defaultHomeCurrency)
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [travelerCount, setTravelerCount] = useState(1)
  const [travelerNames, setTravelerNames] = useState('')
  const [budgetTarget, setBudgetTarget] = useState('')
  const [timezone, setTimezone] = useState('')
  const [notes, setNotes] = useState('')

  const resetForm = useCallback(() => {
    setName('')
    setType('general')
    setStartDate(todayISO())
    setEndDate(addDays(todayISO(), 6))
    setHomeCurrency(defaultHomeCurrency)
    setTripCurrency(defaultHomeCurrency)
    setDestinations([])
    setTravelerCount(1)
    setTravelerNames('')
    setBudgetTarget('')
    setTimezone('')
    setNotes('')
  }, [defaultHomeCurrency])

  // Re-sync the form every time the dialog opens — either blank for a new
  // trip, or pre-filled when editing. The dialog stays mounted between
  // opens (it lives at the App/TripDetail level), so plain useState
  // initializers only ever run once and can't react to `existing` changing.
  useEffect(() => {
    if (!open) return
    if (existing) {
      setName(existing.name)
      setType(existing.type)
      setStartDate(existing.startDate)
      setEndDate(existing.endDate)
      setHomeCurrency(existing.homeCurrency)
      setTripCurrency(existing.tripCurrency)
      setDestinations(existing.destinations ?? [])
      setTravelerCount(existing.travelerCount > 0 ? existing.travelerCount : 1)
      setTravelerNames((existing.travelers ?? []).join(', '))
      setBudgetTarget(existing.budgetTarget != null ? String(existing.budgetTarget) : '')
      setTimezone(existing.timezone ?? '')
      setNotes(existing.notes ?? '')
    } else {
      resetForm()
    }
  }, [open, existing, resetForm])

  const durationDays = useMemo(() => {
    const s = new Date(startDate + 'T00:00:00').getTime()
    const e = new Date(endDate + 'T00:00:00').getTime()
    if (Number.isNaN(s) || Number.isNaN(e)) return 0
    return Math.max(1, Math.round((e - s) / 86_400_000) + 1)
  }, [startDate, endDate])

  const canSubmit = name.trim().length >= 1 && startDate && endDate && startDate <= endDate

  const handleAddDestination = (place: {
    city: string
    country: string
    countryCode: string
    latitude: number
    longitude: number
  }) => {
    setDestinations((prev) => [
      ...prev,
      {
        city: place.city,
        country: place.country,
        countryCode: place.countryCode,
        latitude: place.latitude,
        longitude: place.longitude,
      },
    ])
    if (destinations.length === 0) {
      const guess = COUNTRY_CURRENCY[place.countryCode]
      if (guess) setTripCurrency(guess)
      if (!name.trim()) setName(`${place.city} trip`)
    }
  }

  const removeDestination = (idx: number) => {
    setDestinations((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!canSubmit) return
    const names = travelerNames
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const budget = Number(budgetTarget)
    const value: TripFormValue = {
      name: name.trim(),
      type,
      startDate,
      endDate,
      homeCurrency,
      tripCurrency,
      destinations,
      travelerCount: Math.max(1, travelerCount),
      travelers: names,
      budgetTarget: Number.isFinite(budget) && budget > 0 ? budget : undefined,
      timezone: timezone || undefined,
      notes: notes.trim() || undefined,
    }
    if (existing) {
      onSave?.(existing.id, value)
    } else {
      onCreate?.(value)
      resetForm()
    }
  }

  const handleClose = useCallback(() => {
    onClose()
    resetForm()
  }, [onClose, resetForm])

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={existing ? 'Edit trip' : 'Plan a new trip'}
      subtitle={
        existing
          ? 'Update any detail — nothing else about the trip changes.'
          : 'Fill in what you know — everything is editable later.'
      }
      size="lg"
      footer={
        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={handleClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="create-trip-form"
            className="btn btn-primary"
            disabled={!canSubmit}
          >
            <Icon name={existing ? 'check' : 'plus'} size={15} />
            {existing ? 'Save changes' : 'Create trip'}
          </button>
        </div>
      }
    >
      <form id="create-trip-form" onSubmit={handleSubmit} className="trip-form">
        <label className="label">
          <span>Trip name</span>
          <input
            className="input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Bali honeymoon, Q3 client visit"
            maxLength={80}
            required
          />
        </label>

        <div className="label">
          <span>Trip type</span>
          <div className="type-chips">
            {TRIP_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                className={`type-chip ${type === t ? 'active' : ''}`}
                onClick={() => setType(t)}
              >
                <Icon name={TRIP_TYPE_ICONS[t] as IconName} size={14} />
                {TRIP_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        <div className="label">
          <span>Destinations</span>
          <DestinationSearch onSelect={handleAddDestination} />
          {destinations.length > 0 && (
            <ul className="dest-list">
              {destinations.map((d, i) => (
                <li key={`${d.city}-${i}`}>
                  <Icon name="mapPin" size={13} />
                  <span>
                    <strong>{d.city}</strong>
                    <small>{d.country}</small>
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon"
                    onClick={() => removeDestination(i)}
                    aria-label={`Remove ${d.city}`}
                  >
                    <Icon name="close" size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="row-2">
          <label className="label">
            <span>Start date</span>
            <input
              className="input"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </label>
          <label className="label">
            <span>End date</span>
            <input
              className="input"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
              required
            />
          </label>
        </div>
        <p className="trip-form-hint">
          <Icon name="calendar" size={13} /> {durationDays} day{durationDays !== 1 && 's'}
        </p>

        <div className="row-2">
          <label className="label">
            <span>Your home currency</span>
            <select
              className="select"
              value={homeCurrency}
              onChange={(e) => setHomeCurrency(e.target.value)}
            >
              {COMMON_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name}
                  {!hasLiveRates(c.code) ? ' (no live rates)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="label">
            <span>Trip / destination currency</span>
            <select
              className="select"
              value={tripCurrency}
              onChange={(e) => setTripCurrency(e.target.value)}
            >
              {COMMON_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name}
                  {!hasLiveRates(c.code) ? ' (no live rates)' : ''}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="row-2">
          <label className="label">
            <span>Travelers</span>
            <input
              className="input"
              type="number"
              min={1}
              max={30}
              value={travelerCount}
              onChange={(e) => setTravelerCount(Number(e.target.value))}
            />
          </label>
          <label className="label">
            <span>Names (optional, comma separated)</span>
            <input
              className="input"
              type="text"
              placeholder="e.g. Ana, Priya, Sam"
              value={travelerNames}
              onChange={(e) => setTravelerNames(e.target.value)}
            />
          </label>
        </div>

        <div className="row-2">
          <label className="label">
            <span>Budget target (optional)</span>
            <input
              className="input mono"
              type="number"
              min={0}
              step={1}
              value={budgetTarget}
              onChange={(e) => setBudgetTarget(e.target.value)}
              placeholder={`In ${homeCurrency}`}
            />
          </label>
          <label className="label">
            <span>Local timezone (optional)</span>
            <select
              className="select"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            >
              <option value="">Device local</option>
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="label">
          <span>Notes (optional)</span>
          <textarea
            className="textarea"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything worth remembering — visa requirements, a reminder to call the hotel…"
            rows={2}
          />
        </label>
      </form>
    </Dialog>
  )
}
