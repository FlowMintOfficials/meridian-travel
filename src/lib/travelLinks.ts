/** Outbound links to public, third-party sources — Meridian never embeds
 * live flight data or visa-requirement data itself (both need either a
 * paid API or a dataset that can silently go stale/wrong), so these just
 * open the right search on the right site instead. Client-side only. */

/** FlightAware's flight number search covers most airlines/routes with
 * no account or API key needed. */
export function flightTrackingUrl(flightNumber: string): string {
  return `https://www.flightaware.com/live/flight/${encodeURIComponent(flightNumber.trim().replace(/\s+/g, ''))}`
}

/** No single tracker covers rail operators worldwide, so this is a plain
 * web search rather than a specific site. */
export function trainStatusSearchUrl(carrier: string | undefined, trainNumber: string): string {
  const q = [carrier, 'train', trainNumber, 'status'].filter(Boolean).join(' ')
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`
}

/** Entry/visa requirements depend on the traveler's nationality, which
 * Meridian doesn't collect — a search (rather than a bundled dataset) is
 * the only answer that can't be wrong or go stale. */
export function entryRequirementsSearchUrl(country: string): string {
  return webSearchUrl(`visa and entry requirements for ${country}`)
}

/** Generic fallback for anything Meridian's bundled reference data
 * (plug type, tipping norms, ...) doesn't have an entry for. */
export function webSearchUrl(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`
}

export function openLink(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer')
}
