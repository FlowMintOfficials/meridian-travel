import { useMemo, useState } from 'react'
import { Icon } from './Icon'
import { EmptyState } from './EmptyState'
import { CONVERSIONS, type ConversionUnit } from '../lib/unitConversion'
import { findPlugVoltage } from '../lib/plugVoltage'
import { findTipping } from '../lib/tippingGuide'
import {
  callHomeWindows,
  getUtcOffsetMinutes,
  jetLagAdvice,
  timezoneDifferenceHours,
} from '../lib/timezone'
import { computeSunTimes, formatSunTime } from '../lib/sunTimes'
import { formatShortDate, todayISO } from '../lib/tripHelpers'
import { openLink, webSearchUrl } from '../lib/travelLinks'
import { convert, formatMoney } from '../lib/currency'
import { CUSTOMS_ALLOWANCE_DATA, findCustomsAllowance } from '../lib/customsAllowance'
import type { MeridianData, Trip } from '../types'

interface ToolkitTabProps {
  trip: Trip
  data: MeridianData
}

/** Best first guess at "which customs allowance applies to me" from the
 * trip's home currency — the picker below is always there to override
 * it, this just saves a click for the common case. */
const CURRENCY_TO_CUSTOMS_COUNTRY: Record<string, string> = {
  USD: 'United States',
  CAD: 'Canada',
  GBP: 'United Kingdom',
  EUR: 'European Union',
  AUD: 'Australia',
  NZD: 'New Zealand',
  JPY: 'Japan',
  SGD: 'Singapore',
  KRW: 'South Korea',
  INR: 'India',
}

const CUSTOMS_OTHER = '__other__'

export function ToolkitTab({ trip, data }: ToolkitTabProps) {
  const destinations = trip.destinations
  const [selectedCountry, setSelectedCountry] = useState(destinations[0]?.country ?? '')
  const country = selectedCountry || destinations[0]?.country || ''

  const plugInfo = country ? findPlugVoltage(country) : null
  const tipInfo = country ? findTipping(country) : null

  const homeTz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, [])
  const destTz = trip.timezone
  const hoursDiff = destTz ? timezoneDifferenceHours(destTz, homeTz) : null
  const homeKnown = destTz ? getUtcOffsetMinutes(homeTz) != null : false
  const callWindows = useMemo(
    () => (destTz && homeKnown ? callHomeWindows(destTz, homeTz) : []),
    [destTz, homeTz, homeKnown],
  )

  // Sun times need one specific date — "today" while the trip is under
  // way, otherwise clamped to whichever end of the trip is closest (so
  // an upcoming or already-finished trip still shows something sane
  // rather than today's completely unrelated sun times).
  const planDate = useMemo(() => {
    const today = todayISO()
    if (today < trip.startDate) return trip.startDate
    if (today > trip.endDate) return trip.endDate
    return today
  }, [trip.startDate, trip.endDate])

  const selectedDest = destinations.find((d) => d.country === country) ?? destinations[0]
  const sunTimes = useMemo(() => {
    if (!selectedDest || selectedDest.latitude == null || selectedDest.longitude == null) {
      return null
    }
    return computeSunTimes(selectedDest.latitude, selectedDest.longitude, planDate)
  }, [selectedDest, planDate])

  const [homeCountry, setHomeCountry] = useState(
    () => CURRENCY_TO_CUSTOMS_COUNTRY[trip.homeCurrency] ?? CUSTOMS_ALLOWANCE_DATA[0].country,
  )
  const [customHomeCountry, setCustomHomeCountry] = useState('')
  const isOtherHomeCountry = homeCountry === CUSTOMS_OTHER
  const customsHomeCountryLabel = isOtherHomeCountry
    ? customHomeCountry.trim() || 'your country'
    : homeCountry
  const allowance = isOtherHomeCountry ? null : findCustomsAllowance(homeCountry)

  const shoppingExpenses = useMemo(
    () => data.expenses.filter((e) => e.tripId === trip.id && e.category === 'shopping'),
    [data.expenses, trip.id],
  )
  const customsTotals = useMemo(() => {
    if (!allowance) return null
    let converted = 0
    let unconverted = 0
    for (const e of shoppingExpenses) {
      const amt = convert(e.amount, e.currency, allowance.currency, data.cachedRates)
      if (amt == null) {
        unconverted += 1
      } else {
        converted += amt
      }
    }
    return { converted, unconverted }
  }, [allowance, shoppingExpenses, data.cachedRates])
  const customsPct = customsTotals && allowance ? (customsTotals.converted / allowance.amount) * 100 : 0

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

        <div className="toolkit-card">
          <p className="fx-eyebrow">
            <Icon name="sun" size={12} /> Sun &amp; golden hour
          </p>
          {sunTimes == null ? (
            <p className="toolkit-empty">
              No coordinates on file for {country} — re-add this destination (Edit trip) to
              unlock sun times.
            </p>
          ) : (
            <>
              <div className="toolkit-sun-grid">
                <div>
                  <span className="toolkit-sun-label">Sunrise</span>
                  <strong>{formatSunTime(sunTimes.sunrise, destTz)}</strong>
                </div>
                <div>
                  <span className="toolkit-sun-label">Sunset</span>
                  <strong>{formatSunTime(sunTimes.sunset, destTz)}</strong>
                </div>
              </div>
              <p className="toolkit-sun-golden">
                Golden hour {formatSunTime(sunTimes.sunrise, destTz)}–
                {formatSunTime(sunTimes.goldenHourMorningEnd, destTz)} &amp;{' '}
                {formatSunTime(sunTimes.goldenHourEveningStart, destTz)}–
                {formatSunTime(sunTimes.sunset, destTz)}
              </p>
              {(sunTimes.polarDay || sunTimes.polarNight) && (
                <p className="toolkit-tip-note">
                  {sunTimes.polarDay
                    ? "Midnight sun around this date — it won't fully get dark."
                    : "Polar night around this date — the sun won't rise."}
                </p>
              )}
              <p className="toolkit-empty">For {formatShortDate(planDate)}.</p>
            </>
          )}
        </div>

        <div className="toolkit-card">
          <p className="fx-eyebrow">
            <Icon name="globe" size={12} /> Best time to call home
          </p>
          {!destTz ? (
            <p className="toolkit-empty">
              Set a timezone for this trip (Edit trip) to see good call windows.
            </p>
          ) : !homeKnown ? (
            <p className="toolkit-empty">Couldn't work out your home timezone.</p>
          ) : callWindows.length === 0 ? (
            <p className="toolkit-empty">
              No overlap in reasonable hours (8am–10pm) at both ends — a text or voice memo beats
              catching someone asleep.
            </p>
          ) : (
            <div className="toolkit-call-windows">
              {callWindows.map((w, i) => (
                <div key={i} className="toolkit-call-window">
                  <strong>
                    {w.destStart}–{w.destEnd}
                  </strong>
                  <span>
                    your time · {w.homeStart}–{w.homeEnd} back home
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="toolkit-card">
          <p className="fx-eyebrow">
            <Icon name="receipt" size={12} /> Duty-free allowance
          </p>
          <select
            className="select toolkit-customs-select"
            value={homeCountry}
            onChange={(e) => setHomeCountry(e.target.value)}
          >
            {CUSTOMS_ALLOWANCE_DATA.map((c) => (
              <option key={c.country} value={c.country}>
                {c.country}
              </option>
            ))}
            <option value={CUSTOMS_OTHER}>Other…</option>
          </select>
          {isOtherHomeCountry && (
            <input
              className="input"
              type="text"
              value={customHomeCountry}
              onChange={(e) => setCustomHomeCountry(e.target.value)}
              placeholder="Your home country"
            />
          )}
          {!allowance ? (
            <p className="toolkit-empty">
              No data on file for {customsHomeCountryLabel}.{' '}
              <button
                type="button"
                className="itin-maps-link"
                onClick={() =>
                  openLink(webSearchUrl(`${customsHomeCountryLabel} duty free allowance customs`))
                }
              >
                Search →
              </button>
            </p>
          ) : (
            <>
              <div className="exp-budget-bar" aria-hidden>
                <div
                  className={`exp-budget-fill ${
                    customsPct >= 100 ? 'over' : customsPct >= 70 ? 'warn' : ''
                  }`}
                  style={{ width: `${Math.min(100, customsPct)}%` }}
                />
              </div>
              <p className="toolkit-fact">
                {formatMoney(customsTotals?.converted ?? 0, allowance.currency)} of{' '}
                {formatMoney(allowance.amount, allowance.currency)} used ({customsPct.toFixed(0)}
                %)
              </p>
              {customsTotals && customsTotals.unconverted > 0 && (
                <p className="toolkit-empty">
                  {customsTotals.unconverted} shopping expense
                  {customsTotals.unconverted !== 1 ? 's' : ''} couldn't be converted — refresh
                  exchange rates.
                </p>
              )}
              <p className="toolkit-tip-note">{allowance.note}</p>
              <p className="toolkit-empty">
                Rough planning guide, not customs advice — confirm current limits with{' '}
                {customsHomeCountryLabel}'s customs authority before you travel.
              </p>
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
