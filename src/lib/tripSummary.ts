import { convert, formatMoney } from './currency'
import {
  TRIP_TYPE_LABELS,
  addDays,
  formatDateRange,
  formatShortDate,
  primaryDestination,
  tripDurationDays,
} from './tripHelpers'
import type {
  ExpenseCategory,
  ItineraryEventType,
  MeridianData,
  PackingCategory,
  Trip,
} from '../types'

const EXPENSE_LABELS: Record<ExpenseCategory, string> = {
  lodging: 'Lodging',
  transport: 'Transport',
  food: 'Food & drink',
  activities: 'Activities',
  shopping: 'Shopping',
  groceries: 'Groceries',
  fees: 'Fees & tips',
  other: 'Other',
}

const EVENT_LABELS: Record<ItineraryEventType, string> = {
  transport: 'Transport',
  flight: 'Flight',
  train: 'Train',
  lodging: 'Lodging',
  food: 'Food',
  activity: 'Activity',
  landmark: 'Landmark',
  note: 'Note',
}

const PACK_LABELS: Record<PackingCategory, string> = {
  essentials: 'Essentials',
  clothing: 'Clothing',
  toiletries: 'Toiletries',
  electronics: 'Electronics',
  documents: 'Documents',
  health: 'Health',
  gear: 'Gear',
  kids: 'Kids',
  other: 'Other',
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || 'trip'
  )
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Build a print-friendly HTML summary for a completed trip. */
export function buildTripSummaryHtml(trip: Trip, data: MeridianData): string {
  const duration = tripDurationDays(trip.startDate, trip.endDate)
  const destinations = trip.destinations
    .map((d) => `${d.city}${d.country ? `, ${d.country}` : ''}`)
    .join(' · ')
  const packing = data.packing
    .filter((p) => p.tripId === trip.id)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
  const itinerary = data.itinerary
    .filter((e) => e.tripId === trip.id)
    .sort((a, b) => a.day - b.day || a.order - b.order || (a.startTime ?? '').localeCompare(b.startTime ?? ''))
  const expenses = data.expenses
    .filter((e) => e.tripId === trip.id)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
  const docs = data.documents.filter((d) => d.tripId === trip.id)
  const emergency = data.emergencyContacts.filter((c) => c.tripId === trip.id)

  let spent = 0
  let unconverted = 0
  const byCategory = new Map<ExpenseCategory, number>()
  const byDay = new Map<string, number>()
  const byPaidBy = new Map<string, number>()

  for (const e of expenses) {
    const inHome = convert(e.amount, e.currency, trip.homeCurrency, data.cachedRates)
    if (inHome == null) {
      unconverted += 1
      continue
    }
    spent += inHome
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + inHome)
    byDay.set(e.date, (byDay.get(e.date) ?? 0) + inHome)
    if (e.paidBy) {
      byPaidBy.set(e.paidBy, (byPaidBy.get(e.paidBy) ?? 0) + inHome)
    }
  }

  const dailyAvg = byDay.size > 0 ? spent / byDay.size : 0
  const packed = packing.filter((p) => p.status === 'packed').length
  const skipped = packing.filter((p) => p.status === 'skip').length
  const todo = packing.filter((p) => p.status === 'todo').length

  const maxDay = itinerary.reduce((m, e) => Math.max(m, e.day), duration)
  // Group once instead of re-filtering the (already-sorted) itinerary array
  // once per day of the trip — same O(n) grouping ItineraryTab already uses.
  const eventsByDay = new Map<number, typeof itinerary>()
  for (const e of itinerary) {
    const list = eventsByDay.get(e.day) ?? []
    list.push(e)
    eventsByDay.set(e.day, list)
  }
  const daySections: string[] = []
  for (let day = 1; day <= Math.max(maxDay, duration); day++) {
    const events = eventsByDay.get(day) ?? []
    if (events.length === 0 && day > duration) continue
    const dateLabel = formatShortDate(addDays(trip.startDate, day - 1))
    const rows =
      events.length === 0
        ? `<li class="muted">No events logged</li>`
        : events
            .map((e) => {
              const time =
                e.startTime || e.endTime
                  ? `<span class="time">${esc([e.startTime, e.endTime].filter(Boolean).join('–'))}</span>`
                  : ''
              const meta = [
                EVENT_LABELS[e.type],
                e.address,
                e.cost != null
                  ? formatMoney(e.cost, e.costCurrency ?? trip.tripCurrency)
                  : null,
                e.bookingRef ? `Ref ${e.bookingRef}` : null,
              ]
                .filter(Boolean)
                .join(' · ')
              return `<li>${time}<strong>${esc(e.title)}</strong>
                <div class="meta">${esc(meta)}</div>
                ${e.notes ? `<div class="note">${esc(e.notes)}</div>` : ''}
              </li>`
            })
            .join('')
    daySections.push(`
      <div class="day">
        <h3>Day ${day} <span>${esc(dateLabel)}</span></h3>
        <ul>${rows}</ul>
      </div>`)
  }

  const categoryRows = Array.from(byCategory.entries())
    .sort((a, b) => b[1] - a[1])
    .map(
      ([cat, amount]) =>
        `<tr><td>${esc(EXPENSE_LABELS[cat])}</td><td class="num">${esc(formatMoney(amount, trip.homeCurrency))}</td>
         <td class="num muted">${spent > 0 ? Math.round((amount / spent) * 100) : 0}%</td></tr>`,
    )
    .join('')

  const expenseRows = expenses
    .map((e) => {
      const inHome = convert(e.amount, e.currency, trip.homeCurrency, data.cachedRates)
      return `<tr>
        <td>${esc(formatShortDate(e.date))}</td>
        <td>${esc(e.description || EXPENSE_LABELS[e.category])}</td>
        <td>${esc(EXPENSE_LABELS[e.category])}</td>
        <td class="num">${esc(formatMoney(e.amount, e.currency))}</td>
        <td class="num">${inHome != null ? esc(formatMoney(inHome, trip.homeCurrency)) : '—'}</td>
        <td>${esc(e.paidBy ?? '')}</td>
      </tr>`
    })
    .join('')

  const packingByCat = new Map<PackingCategory, typeof packing>()
  for (const item of packing) {
    const list = packingByCat.get(item.category) ?? []
    list.push(item)
    packingByCat.set(item.category, list)
  }
  const packingSections = Array.from(packingByCat.entries())
    .map(([cat, items]) => {
      const lines = items
        .map((i) => {
          const mark = i.status === 'packed' ? '✓' : i.status === 'skip' ? '–' : '○'
          return `<li><span class="mark">${mark}</span> ${esc(i.name)}${i.quantity > 1 ? ` ×${i.quantity}` : ''}${i.essential ? ' <em>essential</em>' : ''}</li>`
        })
        .join('')
      return `<div class="pack-cat"><h4>${esc(PACK_LABELS[cat])}</h4><ul>${lines}</ul></div>`
    })
    .join('')

  const paidByRows = Array.from(byPaidBy.entries())
    .sort((a, b) => b[1] - a[1])
    .map(
      ([name, amount]) =>
        `<tr><td>${esc(name)}</td><td class="num">${esc(formatMoney(amount, trip.homeCurrency))}</td></tr>`,
    )
    .join('')

  const generated = new Date().toLocaleString()
  const completedLine = trip.completedAt
    ? `Completed ${formatShortDate(trip.completedAt.slice(0, 10))}`
    : 'Marked complete'

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(trip.name)} — Trip summary</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0 auto;
    max-width: 820px;
    padding: 40px 28px 64px;
    font: 15px/1.5 "Segoe UI", system-ui, sans-serif;
    color: #0f172a;
    background: #fff;
  }
  h1 { font-size: 28px; letter-spacing: -0.03em; margin: 0 0 6px; }
  h2 {
    font-size: 13px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #0f766e;
    margin: 36px 0 12px;
    padding-bottom: 6px;
    border-bottom: 1px solid #e2e8f0;
  }
  h3 { font-size: 16px; margin: 0 0 8px; }
  h3 span { font-weight: 500; color: #64748b; font-size: 13px; margin-left: 8px; }
  h4 { margin: 0 0 6px; font-size: 13px; color: #475569; }
  .eyebrow { color: #64748b; font-size: 13px; margin: 0 0 4px; }
  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px;
    margin: 20px 0;
  }
  .stat {
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 12px 14px;
    background: #f8fafc;
  }
  .stat strong { display: block; font-size: 18px; letter-spacing: -0.02em; }
  .stat span { color: #64748b; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  th { color: #64748b; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .muted { color: #94a3b8; }
  ul { margin: 0; padding-left: 0; list-style: none; }
  li { padding: 6px 0; border-bottom: 1px solid #f1f5f9; }
  .time {
    display: inline-block;
    min-width: 72px;
    color: #0f766e;
    font-variant-numeric: tabular-nums;
    font-size: 12px;
    margin-right: 8px;
  }
  .meta, .note { color: #64748b; font-size: 12px; margin-top: 2px; }
  .day { margin-bottom: 18px; }
  .pack-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
  .mark { display: inline-block; width: 1.1em; color: #0f766e; }
  em { font-style: normal; color: #b45309; font-size: 11px; }
  .footer {
    margin-top: 40px;
    padding-top: 16px;
    border-top: 1px solid #e2e8f0;
    color: #94a3b8;
    font-size: 12px;
  }
  @media print {
    body { padding: 12px; }
    .stat { break-inside: avoid; }
    .day { break-inside: avoid; }
  }
</style>
</head>
<body>
  <p class="eyebrow">Meridian trip summary · ${esc(completedLine)}</p>
  <h1>${esc(trip.name)}</h1>
  <p class="eyebrow">
    ${esc(destinations || primaryDestination(trip))} ·
    ${esc(formatDateRange(trip.startDate, trip.endDate))} ·
    ${duration} day${duration !== 1 ? 's' : ''} ·
    ${esc(TRIP_TYPE_LABELS[trip.type])}
  </p>
  ${
    trip.travelers.length
      ? `<p class="eyebrow">Travelers: ${esc(trip.travelers.join(', '))}</p>`
      : ''
  }
  ${trip.notes ? `<p>${esc(trip.notes)}</p>` : ''}

  <div class="stats">
    <div class="stat">
      <strong>${esc(formatMoney(spent, trip.homeCurrency))}</strong>
      <span>Total spent (${esc(trip.homeCurrency)})</span>
    </div>
    <div class="stat">
      <strong>${byDay.size ? esc(formatMoney(dailyAvg, trip.homeCurrency)) : '—'}</strong>
      <span>Daily average</span>
    </div>
    <div class="stat">
      <strong>${expenses.length}</strong>
      <span>Expense entries</span>
    </div>
    <div class="stat">
      <strong>${itinerary.length}</strong>
      <span>Itinerary events</span>
    </div>
    <div class="stat">
      <strong>${packed}/${packing.length || 0}</strong>
      <span>Items packed</span>
    </div>
  </div>
  ${
    unconverted > 0
      ? `<p class="muted">${unconverted} expense${unconverted !== 1 ? 's' : ''} could not be converted (missing rates).</p>`
      : ''
  }

  <h2>Budget by category</h2>
  ${
    categoryRows
      ? `<table>
        <thead><tr><th>Category</th><th class="num">Amount</th><th class="num">Share</th></tr></thead>
        <tbody>${categoryRows}</tbody>
        <tfoot><tr><td><strong>Total</strong></td><td class="num"><strong>${esc(formatMoney(spent, trip.homeCurrency))}</strong></td><td></td></tr></tfoot>
      </table>`
      : `<p class="muted">No expenses logged.</p>`
  }

  ${
    paidByRows
      ? `<h2>Spent by person</h2>
      <table>
        <thead><tr><th>Name</th><th class="num">Amount (${esc(trip.homeCurrency)})</th></tr></thead>
        <tbody>${paidByRows}</tbody>
      </table>`
      : ''
  }

  <h2>All expenses</h2>
  ${
    expenseRows
      ? `<table>
        <thead>
          <tr>
            <th>Date</th><th>Description</th><th>Category</th>
            <th class="num">Amount</th><th class="num">${esc(trip.homeCurrency)}</th><th>Paid by</th>
          </tr>
        </thead>
        <tbody>${expenseRows}</tbody>
      </table>`
      : `<p class="muted">No expenses logged.</p>`
  }

  <h2>Itinerary</h2>
  ${daySections.length ? daySections.join('') : `<p class="muted">No itinerary events.</p>`}

  <h2>Packing list</h2>
  <p class="eyebrow">Packed ${packed} · Skipped ${skipped} · Still todo ${todo}</p>
  ${
    packingSections
      ? `<div class="pack-grid">${packingSections}</div>`
      : `<p class="muted">No packing items.</p>`
  }

  ${
    docs.length
      ? `<h2>Documents on file</h2>
      <ul>${docs.map((d) => `<li>${esc(d.name)} <span class="muted">(${esc(d.kind)})</span></li>`).join('')}</ul>
      <p class="muted">Encrypted file contents are not included in this summary.</p>`
      : ''
  }

  ${
    emergency.length
      ? `<h2>Emergency contacts</h2>
      <ul>${emergency.map((c) => `<li><strong>${esc(c.label)}</strong> — ${esc(c.detail)} <span class="muted">(${esc(c.kind)})</span></li>`).join('')}</ul>`
      : ''
  }

  <p class="footer">Generated by Meridian on ${esc(generated)}. Open this file in a browser and use Print → Save as PDF if you want a PDF copy.</p>
</body>
</html>`
}

/** Download a trip summary as an HTML file (print / Save as PDF friendly). */
export function downloadTripSummary(trip: Trip, data: MeridianData): void {
  const html = buildTripSummaryHtml(trip, data)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  downloadBlob(blob, `meridian-${slugify(trip.name)}-summary.html`)
}

/** Open the summary in a print window — choose “Save as PDF” in the print dialog. */
export function printTripSummaryPdf(trip: Trip, data: MeridianData): void {
  const html = buildTripSummaryHtml(trip, data)
  const w = window.open('', '_blank', 'noopener,noreferrer')
  if (!w) {
    downloadTripSummary(trip, data)
    return
  }
  w.document.open()
  w.document.write(html)
  w.document.close()
  w.focus()
  // Give styles a tick to apply before the print dialog.
  window.setTimeout(() => {
    try {
      w.print()
    } catch {
      // user can print manually
    }
  }, 250)
}
