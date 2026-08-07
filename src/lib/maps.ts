/** Open address / place in the user's maps app (client-side only). */
export function mapsSearchUrl(query: string): string {
  const q = encodeURIComponent(query.trim())
  return `https://www.google.com/maps/search/?api=1&query=${q}`
}

export function mapsDirectionsUrl(destination: string, origin?: string): string {
  const dest = encodeURIComponent(destination.trim())
  if (origin?.trim()) {
    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin.trim())}&destination=${dest}`
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}`
}

export function openMaps(query: string): void {
  if (!query.trim()) return
  window.open(mapsSearchUrl(query), '_blank', 'noopener,noreferrer')
}
