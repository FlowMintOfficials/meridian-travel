import { useMemo, useState, type FormEvent } from 'react'
import { Icon, type IconName } from './Icon'
import { EmptyState } from './EmptyState'
import { Dialog } from './Dialog'
import type {
  ItineraryEvent,
  ItineraryEventType,
  MeridianData,
  Trip,
} from '../types'
import type { MeridianStore } from '../hooks/useMeridian'
import { COMMON_CURRENCIES, formatMoney } from '../lib/currency'
import { openMaps } from '../lib/maps'
import { formatLocalTime, timezoneLabel } from '../lib/timezone'
import { addDays, formatDay, tripDurationDays } from '../lib/tripHelpers'
import type { ToastFn } from './Toast'

interface ItineraryTabProps {
  trip: Trip
  data: MeridianData
  store: MeridianStore
  onToast: ToastFn
}

const EVENT_META: Record<
  ItineraryEventType,
  { label: string; icon: IconName; color: string }
> = {
  transport: { label: 'Transport', icon: 'car', color: 'var(--info)' },
  flight: { label: 'Flight', icon: 'plane', color: '#818cf8' },
  train: { label: 'Train', icon: 'map', color: '#38bdf8' },
  lodging: { label: 'Lodging', icon: 'building', color: 'var(--accent-hi)' },
  food: { label: 'Food', icon: 'utensils', color: 'var(--warning)' },
  activity: { label: 'Activity', icon: 'sparkle', color: 'var(--accent)' },
  landmark: { label: 'Landmark', icon: 'mapPin', color: 'var(--success)' },
  note: { label: 'Note', icon: 'fileText', color: 'var(--muted)' },
}

const EVENT_TYPES: ItineraryEventType[] = [
  'flight',
  'train',
  'transport',
  'lodging',
  'food',
  'activity',
  'landmark',
  'note',
]

export function ItineraryTab({ trip, data, store, onToast }: ItineraryTabProps) {
  const [selectedDay, setSelectedDay] = useState<number>(1)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ItineraryEvent | null>(null)

  const duration = tripDurationDays(trip.startDate, trip.endDate)
  const events = useMemo(
    () => data.itinerary.filter((e) => e.tripId === trip.id),
    [data.itinerary, trip.id],
  )

  const dayGroups = useMemo(() => {
    const map = new Map<number, ItineraryEvent[]>()
    for (const e of events) {
      const arr = map.get(e.day) ?? []
      arr.push(e)
      map.set(e.day, arr)
    }
    for (const [, arr] of map) {
      arr.sort((a, b) => {
        if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime)
        if (a.startTime) return -1
        if (b.startTime) return 1
        return a.order - b.order
      })
    }
    return map
  }, [events])

  const openCreate = (day: number) => {
    setSelectedDay(day)
    setEditing(null)
    setDialogOpen(true)
  }

  const openEdit = (evt: ItineraryEvent) => {
    setSelectedDay(evt.day)
    setEditing(evt)
    setDialogOpen(true)
  }

  const handleSubmit = (input: EventFormValue) => {
    const patch = {
      day: input.day,
      title: input.title,
      type: input.type,
      startTime: input.startTime || undefined,
      endTime: input.endTime || undefined,
      address: input.address || undefined,
      notes: input.notes || undefined,
      cost: input.cost != null ? input.cost : undefined,
      costCurrency: input.costCurrency,
      bookingRef: input.bookingRef || undefined,
      bookingUrl: input.bookingUrl || undefined,
      carrier: input.carrier || undefined,
      flightNumber: input.flightNumber || undefined,
      departureStation: input.departureStation || undefined,
      arrivalStation: input.arrivalStation || undefined,
      terminal: input.terminal || undefined,
      gate: input.gate || undefined,
      seat: input.seat || undefined,
    }
    if (editing) {
      store.updateItineraryEvent(editing.id, patch)
      onToast(`Updated "${input.title}"`, 'success')
    } else {
      store.addItineraryEvent(trip.id, patch)
      onToast(`Added "${input.title}" to day ${input.day}`, 'success')
    }
    setDialogOpen(false)
    setEditing(null)
  }

  const handleDelete = (evt: ItineraryEvent) => {
    store.deleteItineraryEvent(evt.id)
    onToast(`"${evt.title}" removed.`, 'info', {
      label: 'Undo',
      onClick: () => store.restoreItineraryEvent(evt),
    })
  }

  const totalEvents = events.length
  const daysWithEvents = new Set(events.map((e) => e.day)).size

  if (totalEvents === 0) {
    return (
      <div className="itin">
        <EmptyState
          icon="map"
          title="Plan your days"
          description={`Add flights, hotel check-ins, dinner reservations, and anything else you want to remember. The full ${duration}-day timeline is ready when you are.`}
          action={
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => openCreate(1)}
            >
              <Icon name="plus" size={14} /> Add first event
            </button>
          }
        />

        {dialogOpen && (
          <EventDialog
            open={dialogOpen}
            onClose={() => setDialogOpen(false)}
            duration={duration}
            defaultDay={selectedDay}
            defaultCurrency={trip.tripCurrency}
            existing={editing}
            onSubmit={handleSubmit}
          />
        )}
      </div>
    )
  }

  return (
    <section className="itin">
      <header className="itin-head">
        <div className="itin-stats">
          <strong className="mono">{totalEvents}</strong>
          <span> event{totalEvents !== 1 && 's'} across </span>
          <strong className="mono">{daysWithEvents}</strong>
          <span> day{daysWithEvents !== 1 && 's'}</span>
          {trip.timezone && (
            <span className="itin-tz"> · {timezoneLabel(trip.timezone)}</span>
          )}
        </div>
        <div className="itin-actions">
          <button
            type="button"
            className="btn"
            onClick={() => window.print()}
            title="Print itinerary"
          >
            <Icon name="print" size={14} /> <span>Print</span>
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => openCreate(1)}
          >
            <Icon name="plus" size={14} /> <span>Add event</span>
          </button>
        </div>
      </header>

      <div className="itin-timeline">
        {Array.from({ length: duration }, (_, i) => i + 1).map((day) => {
          const iso = addDays(trip.startDate, day - 1)
          const dayEvents = dayGroups.get(day) ?? []
          return (
            <div key={day} className="itin-day">
              <div className="itin-day-side">
                <span className="itin-day-num mono">D{day}</span>
                <span className="itin-day-label">{formatDay(iso)}</span>
                <button
                  type="button"
                  className="itin-day-add"
                  onClick={() => openCreate(day)}
                  aria-label={`Add event to day ${day}`}
                >
                  <Icon name="plus" size={12} />
                </button>
              </div>

              <div className="itin-day-events">
                {dayEvents.length === 0 ? (
                  <button
                    type="button"
                    className="itin-day-empty"
                    onClick={() => openCreate(day)}
                  >
                    Add something for day {day}
                  </button>
                ) : (
                  dayEvents.map((evt) => (
                    <EventCard
                      key={evt.id}
                      event={evt}
                      dayDate={iso}
                      timezone={trip.timezone}
                      onEdit={() => openEdit(evt)}
                      onDelete={() => handleDelete(evt)}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      {dialogOpen && (
        <EventDialog
          open={dialogOpen}
          onClose={() => {
            setDialogOpen(false)
            setEditing(null)
          }}
          duration={duration}
          defaultDay={selectedDay}
          defaultCurrency={trip.tripCurrency}
          existing={editing}
          onSubmit={handleSubmit}
        />
      )}
    </section>
  )
}

// -------------------------------------------------------------------

function EventCard({
  event,
  dayDate,
  timezone,
  onEdit,
  onDelete,
}: {
  event: ItineraryEvent
  dayDate: string
  timezone?: string
  onEdit: () => void
  onDelete: () => void
}) {
  const meta = EVENT_META[event.type] ?? EVENT_META.activity
  const timeLabel = formatLocalTime(event.startTime, timezone, dayDate)
  const endLabel = formatLocalTime(event.endTime, timezone, dayDate)
  const route =
    event.departureStation || event.arrivalStation
      ? [event.departureStation, event.arrivalStation].filter(Boolean).join(' → ')
      : null
  const flightBits = [
    event.carrier,
    event.flightNumber,
    event.terminal ? `T${event.terminal}` : null,
    event.gate ? `Gate ${event.gate}` : null,
    event.seat ? `Seat ${event.seat}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <article className={`itin-event type-${event.type}`}>
      <span
        className="itin-event-icon"
        aria-hidden
        style={{ background: meta.color, color: '#042018' }}
      >
        <Icon name={meta.icon} size={13} />
      </span>
      <div className="itin-event-body">
        <div className="itin-event-head">
          {timeLabel && (
            <span className="itin-time mono">
              {timeLabel}
              {endLabel && event.endTime && ` – ${event.endTime}`}
            </span>
          )}
          <span className={`chip itin-event-chip`} style={{ color: meta.color }}>
            {meta.label}
          </span>
        </div>
        <h4 className="itin-event-title">{event.title}</h4>
        {flightBits && (
          <p className="itin-event-meta">
            <Icon name="plane" size={12} /> {flightBits}
          </p>
        )}
        {route && (
          <p className="itin-event-meta">
            <Icon name="map" size={12} /> {route}
          </p>
        )}
        {event.address && (
          <p className="itin-event-meta">
            <Icon name="mapPin" size={12} /> {event.address}{' '}
            <button
              type="button"
              className="itin-maps-link"
              onClick={() => openMaps(event.address!)}
            >
              Open maps
            </button>
          </p>
        )}
        {(event.bookingRef || event.bookingUrl) && (
          <p className="itin-event-meta">
            <Icon name="receipt" size={12} />
            {event.bookingUrl ? (
              <a
                href={event.bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                {event.bookingRef || 'Booking link'}
              </a>
            ) : (
              event.bookingRef
            )}
          </p>
        )}
        {event.cost != null && event.costCurrency && (
          <p className="itin-event-meta">
            <Icon name="wallet" size={12} /> {formatMoney(event.cost, event.costCurrency)}
          </p>
        )}
        {event.notes && <p className="itin-event-notes">{event.notes}</p>}
      </div>
      <div className="itin-event-actions">
        <button
          type="button"
          className="pack-mini"
          onClick={onEdit}
          aria-label="Edit event"
        >
          <Icon name="edit" size={13} />
        </button>
        <button
          type="button"
          className="pack-mini danger"
          onClick={onDelete}
          aria-label="Delete event"
        >
          <Icon name="trash" size={13} />
        </button>
      </div>
    </article>
  )
}

// -------------------------------------------------------------------

interface EventFormValue {
  day: number
  title: string
  type: ItineraryEventType
  startTime: string
  endTime: string
  address: string
  notes: string
  cost: number | null
  costCurrency: string
  bookingRef: string
  bookingUrl: string
  carrier: string
  flightNumber: string
  departureStation: string
  arrivalStation: string
  terminal: string
  gate: string
  seat: string
}

interface EventDialogProps {
  open: boolean
  onClose: () => void
  duration: number
  defaultDay: number
  defaultCurrency: string
  existing: ItineraryEvent | null
  onSubmit: (value: EventFormValue) => void
}

function EventDialog({
  open,
  onClose,
  duration,
  defaultDay,
  defaultCurrency,
  existing,
  onSubmit,
}: EventDialogProps) {
  const isTransit =
    existing?.type === 'flight' ||
    existing?.type === 'train' ||
    Boolean(existing?.flightNumber || existing?.departureStation)

  const hasExtras = Boolean(
    existing &&
      (existing.address ||
        existing.notes ||
        existing.cost != null ||
        existing.bookingRef ||
        existing.bookingUrl ||
        existing.endTime ||
        isTransit),
  )

  const [day, setDay] = useState(existing?.day ?? defaultDay)
  const [title, setTitle] = useState(existing?.title ?? '')
  const [type, setType] = useState<ItineraryEventType>(existing?.type ?? 'activity')
  const [startTime, setStartTime] = useState(existing?.startTime ?? '')
  const [endTime, setEndTime] = useState(existing?.endTime ?? '')
  const [address, setAddress] = useState(existing?.address ?? '')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [cost, setCost] = useState<string>(
    existing?.cost != null ? String(existing.cost) : '',
  )
  const [costCurrency, setCostCurrency] = useState(
    existing?.costCurrency ?? defaultCurrency,
  )
  const [bookingRef, setBookingRef] = useState(existing?.bookingRef ?? '')
  const [bookingUrl, setBookingUrl] = useState(existing?.bookingUrl ?? '')
  const [carrier, setCarrier] = useState(existing?.carrier ?? '')
  const [flightNumber, setFlightNumber] = useState(existing?.flightNumber ?? '')
  const [departureStation, setDepartureStation] = useState(
    existing?.departureStation ?? '',
  )
  const [arrivalStation, setArrivalStation] = useState(existing?.arrivalStation ?? '')
  const [terminal, setTerminal] = useState(existing?.terminal ?? '')
  const [gate, setGate] = useState(existing?.gate ?? '')
  const [seat, setSeat] = useState(existing?.seat ?? '')
  const [showMore, setShowMore] = useState(hasExtras)

  const canSubmit = title.trim().length > 0
  const showTransit = type === 'flight' || type === 'train'

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!canSubmit) return
    onSubmit({
      day,
      title: title.trim(),
      type,
      startTime,
      endTime: showMore ? endTime : '',
      address: showMore ? address.trim() : '',
      notes: showMore ? notes.trim() : '',
      cost: showMore && cost.trim() !== '' ? Number(cost) : null,
      costCurrency,
      bookingRef: showMore ? bookingRef.trim() : '',
      bookingUrl: showMore ? bookingUrl.trim() : '',
      carrier: showTransit ? carrier.trim() : '',
      flightNumber: showTransit ? flightNumber.trim() : '',
      departureStation: showTransit ? departureStation.trim() : '',
      arrivalStation: showTransit ? arrivalStation.trim() : '',
      terminal: showTransit ? terminal.trim() : '',
      gate: showTransit ? gate.trim() : '',
      seat: showTransit ? seat.trim() : '',
    })
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={existing ? 'Edit plan' : 'Quick add'}
      subtitle={existing ? undefined : 'Just a title is enough — extras are optional.'}
      size="md"
      footer={
        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="event-form"
            className="btn btn-primary"
            disabled={!canSubmit}
          >
            <Icon name="check" size={14} />
            {existing ? 'Save' : 'Add'}
          </button>
        </div>
      }
    >
      <form id="event-form" onSubmit={handleSubmit} className="trip-form itin-quick-form">
        <label className="label">
          <span>What</span>
          <input
            className="input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Flight to Barcelona, Lunch near Sagrada…"
            autoFocus
            required
          />
        </label>

        <div className="label">
          <span>Type</span>
          <div className="type-chips type-chips-compact">
            {EVENT_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                className={`type-chip ${type === t ? 'active' : ''}`}
                onClick={() => setType(t)}
                title={EVENT_META[t].label}
              >
                <Icon name={EVENT_META[t].icon} size={14} />
                <span className="type-chip-label">{EVENT_META[t].label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="row-2">
          <label className="label">
            <span>Day</span>
            <select
              className="select"
              value={day}
              onChange={(e) => setDay(Number(e.target.value))}
            >
              {Array.from({ length: duration }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  Day {d}
                </option>
              ))}
            </select>
          </label>
          <label className="label">
            <span>Time <small className="opt-hint">(optional)</small></span>
            <input
              className="input"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </label>
        </div>

        {showTransit && (
          <div className="itin-transit-fields">
            <div className="row-2">
              <label className="label">
                <span>{type === 'flight' ? 'Airline' : 'Operator'}</span>
                <input
                  className="input"
                  type="text"
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  placeholder={type === 'flight' ? 'e.g. IndiGo' : 'e.g. JR East'}
                />
              </label>
              <label className="label">
                <span>{type === 'flight' ? 'Flight #' : 'Train #'}</span>
                <input
                  className="input"
                  type="text"
                  value={flightNumber}
                  onChange={(e) => setFlightNumber(e.target.value)}
                  placeholder={type === 'flight' ? '6E 234' : 'Hayabusa 12'}
                />
              </label>
            </div>
            <div className="row-2">
              <label className="label">
                <span>From</span>
                <input
                  className="input"
                  type="text"
                  value={departureStation}
                  onChange={(e) => setDepartureStation(e.target.value)}
                  placeholder={type === 'flight' ? 'DEL' : 'Tokyo Station'}
                />
              </label>
              <label className="label">
                <span>To</span>
                <input
                  className="input"
                  type="text"
                  value={arrivalStation}
                  onChange={(e) => setArrivalStation(e.target.value)}
                  placeholder={type === 'flight' ? 'NRT' : 'Kyoto'}
                />
              </label>
            </div>
            <div className="row-2">
              <label className="label">
                <span>Terminal / gate</span>
                <div className="itin-cost-row">
                  <input
                    className="input"
                    type="text"
                    value={terminal}
                    onChange={(e) => setTerminal(e.target.value)}
                    placeholder="T3"
                  />
                  <input
                    className="input"
                    type="text"
                    value={gate}
                    onChange={(e) => setGate(e.target.value)}
                    placeholder="Gate"
                  />
                </div>
              </label>
              <label className="label">
                <span>Seat</span>
                <input
                  className="input"
                  type="text"
                  value={seat}
                  onChange={(e) => setSeat(e.target.value)}
                  placeholder="12A"
                />
              </label>
            </div>
          </div>
        )}

        {!showMore ? (
          <button
            type="button"
            className="itin-more-toggle"
            onClick={() => setShowMore(true)}
          >
            <Icon name="plus" size={13} /> Add location, notes, booking…
          </button>
        ) : (
          <div className="itin-more-block">
            <button
              type="button"
              className="itin-more-toggle is-open"
              onClick={() => setShowMore(false)}
            >
              <Icon name="chevronDown" size={13} /> Hide extra details
            </button>

            <label className="label">
              <span>Location</span>
              <input
                className="input"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Address or place name"
              />
            </label>

            <label className="label">
              <span>Notes</span>
              <textarea
                className="textarea"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything to remember"
                rows={2}
              />
            </label>

            <div className="row-2">
              <label className="label">
                <span>End time</span>
                <input
                  className="input"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </label>
              <label className="label">
                <span>Cost</span>
                <div className="itin-cost-row">
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    min={0}
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    placeholder="0"
                  />
                  <select
                    className="select"
                    value={costCurrency}
                    onChange={(e) => setCostCurrency(e.target.value)}
                    aria-label="Currency"
                  >
                    {COMMON_CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code}
                      </option>
                    ))}
                  </select>
                </div>
              </label>
            </div>

            <label className="label">
              <span>Booking ref</span>
              <input
                className="input"
                type="text"
                value={bookingRef}
                onChange={(e) => setBookingRef(e.target.value)}
                placeholder="Confirmation # or PNR"
              />
            </label>

            <label className="label">
              <span>Booking link</span>
              <input
                className="input"
                type="url"
                value={bookingUrl}
                onChange={(e) => setBookingUrl(e.target.value)}
                placeholder="https://…"
              />
            </label>
          </div>
        )}
      </form>
    </Dialog>
  )
}
