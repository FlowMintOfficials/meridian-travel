import { useMemo, useState } from 'react'
import { Icon } from './Icon'
import { EmptyState } from './EmptyState'
import { CONVERSIONS, type ConversionUnit } from '../lib/unitConversion'
import { findPlugVoltage } from '../lib/plugVoltage'
import { findTipping } from '../lib/tippingGuide'
import { getUtcOffsetMinutes, jetLagAdvice, timezoneDifferenceHours } from '../lib/timezone'
import { openLink, webSearchUrl } from '../lib/travelLinks'
import type { Trip } from '../types'

interface ToolkitTabProps {
  trip: Trip
}

export function ToolkitTab({ trip }: ToolkitTabProps) {
  const destinations = trip.destinations
  const [selectedCountry, setSelectedCountry] = useState(destinations[0]?.country ?? '')
  const country = selectedCountry || destinations[0]?.country || ''

  const plugInfo = country ? findPlugVoltage(country) : null
  const tipInfo = country ? findTipping(country) : null

  const homeTz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, [])
  const destTz = trip.timezone
  const hoursDiff = destTz ? timezoneDifferenceHours(destTz, homeTz) : null
  const homeKnown = destTz ? getUtcOffsetMinutes(homeTz) != null : false

  const [convId, setConvId] = useState<ConversionUnit>('km-mi')
  const [amount, setAmount] = useState('1')
  const [reverse, setReverse] = useState(false)
  const conv = CONVERSIONS.find((c) => c.id === convId)!
  const numAmount = Number(amount) || 0
  const result = reverse ? conv.convertBack(numAmount) : conv.convert(numAmount)
  const fromUnit = reverse ? conv.toLabel : conv.fromLabel
  const toUnit = reverse ? conv.fromLabel : conv.toLabel

  if (destinations.length === 0) {
    return (
      <section className="toolkit-tab">
        <EmptyState
          icon="compass"
          title="Add a destination first"
          description="Plug type, tipping norms, and jet lag are all destination-specific — add one from Edit trip to unlock this tab."
        />
      </section>
    )
  }

  return (
    <section className="toolkit-tab">
      {destinations.length > 1 && (
        <div className="toolkit-dest-picker" role="tablist" aria-label="Destination">
          {destinations.map((d, i) => (
            <button
              key={`${d.country}-${i}`}
              type="button"
              className={`filter-chip ${country === d.country ? 'active' : ''}`}
              onClick={() => setSelectedCountry(d.country)}
            >
              {d.city ? `${d.city}, ${d.country}` : d.country}
            </button>
          ))}
        </div>
      )}

      <div className="toolkit-grid">
        <div className="toolkit-card">
          <p className="fx-eyebrow">
            <Icon name="plug" size={12} /> Power & plugs
          </p>
          {plugInfo ? (
            <>
              <div className="toolkit-plug-types">
                {plugInfo.plugTypes.map((t) => (
                  <span key={t} className="chip accent">
                    Type {t}
                  </span>
                ))}
              </div>
              <p className="toolkit-fact">
                {plugInfo.voltage} · {plugInfo.frequency}
              </p>
            </>
          ) : (
            <p className="toolkit-empty">
              No data on file for {country}.{' '}
              <button
                type="button"
                className="itin-maps-link"
                onClick={() => openLink(webSearchUrl(`${country} plug type voltage`))}
              >
                Search →
              </button>
            </p>
          )}
        </div>

        <div className="toolkit-card">
          <p className="fx-eyebrow">
            <Icon name="wallet" size={12} /> Tipping & etiquette
          </p>
          {tipInfo ? (
            <div className="toolkit-tip-rows">
              <p>
                <strong>Restaurants</strong> {tipInfo.restaurants}
              </p>
              <p>
                <strong>Taxis</strong> {tipInfo.taxis}
              </p>
              <p>
                <strong>Hotels</strong> {tipInfo.hotels}
              </p>
              {tipInfo.note && <p className="toolkit-tip-note">{tipInfo.note}</p>}
            </div>
          ) : (
            <p className="toolkit-empty">
              No data on file for {country}.{' '}
              <button
                type="button"
                className="itin-maps-link"
                onClick={() => openLink(webSearchUrl(`${country} tipping customs`))}
              >
                Search →
              </button>
            </p>
          )}
        </div>

        <div className="toolkit-card">
          <p className="fx-eyebrow">
            <Icon name="clock" size={12} /> Jet lag & timezone
          </p>
          {!destTz ? (
            <p className="toolkit-empty">
              Set a timezone for this trip (Edit trip) to see the difference from your local
              time.
            </p>
          ) : hoursDiff == null || !homeKnown ? (
            <p className="toolkit-empty">Couldn't work out the time difference for this trip.</p>
          ) : (
            <>
              <p className="toolkit-fact toolkit-fact-lg">
                {hoursDiff === 0 ? 'Same time as home' : (
                  <>
                    {hoursDiff > 0 ? '+' : ''}
                    {hoursDiff.toFixed(0)}h vs home
                  </>
                )}
              </p>
              <p className="toolkit-jetlag-advice">{jetLagAdvice(hoursDiff)}</p>
            </>
          )}
        </div>

        <div className="toolkit-card toolkit-converter">
          <p className="fx-eyebrow">
            <Icon name="ruler" size={12} /> Unit converter
          </p>
          <div className="seg toolkit-conv-seg">
            {CONVERSIONS.map((c) => (
              <button
                key={c.id}
                type="button"
                className={convId === c.id ? 'active' : ''}
                onClick={() => setConvId(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="toolkit-convert-row">
            <input
              className="input mono"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <span className="fx-tag">{fromUnit}</span>
            <button
              type="button"
              className="btn btn-ghost btn-icon"
              onClick={() => setReverse((r) => !r)}
              aria-label="Swap direction"
              title="Swap direction"
            >
              <Icon name="refresh" size={14} />
            </button>
            <strong className="toolkit-convert-result mono">
              {result.toFixed(2)} {toUnit}
            </strong>
          </div>
        </div>
      </div>
    </section>
  )
}
