/** General tipping & etiquette guidance by country. Unlike visa rules,
 * getting this slightly wrong has low stakes (mild social awkwardness,
 * not a denied flight), so a bundled reference is fine here — framed as
 * general guidance, not a rulebook, since customs vary by region/venue
 * even within one country. */

export interface TippingInfo {
  country: string
  restaurants: string
  taxis: string
  hotels: string
  note?: string
}

export const TIPPING_DATA: TippingInfo[] = [
  { country: 'United States', restaurants: '18–20%, expected', taxis: '15–20%', hotels: '$1–5/night, $2–5 per bag', note: 'Tipping is a core part of service wages — skipping it is considered rude.' },
  { country: 'Canada', restaurants: '15–18%, expected', taxis: '10–15%', hotels: '$2–5/night' },
  { country: 'Mexico', restaurants: '10–15%', taxis: 'Not expected', hotels: '$1–2/night' },
  { country: 'United Kingdom', restaurants: '10–12.5% if not on the bill', taxis: 'Round up', hotels: '£1–2/night, optional', note: 'Check the bill — a service charge is often already added.' },
  { country: 'Ireland', restaurants: '10%, optional', taxis: 'Round up', hotels: 'Optional' },
  { country: 'France', restaurants: 'Service usually included; round up', taxis: 'Round up', hotels: '€1–2/night, optional', note: '"Service compris" on the bill means tip is already included.' },
  { country: 'Germany', restaurants: '5–10%, round up', taxis: 'Round up', hotels: '€1–2/night' },
  { country: 'Spain', restaurants: '5–10%, optional', taxis: 'Round up', hotels: 'Optional' },
  { country: 'Italy', restaurants: 'Often a small "coperto" cover charge; round up', taxis: 'Round up', hotels: '€1–2/night, optional' },
  { country: 'Portugal', restaurants: '5–10%, optional', taxis: 'Round up', hotels: 'Optional' },
  { country: 'Netherlands', restaurants: '5–10%, optional', taxis: 'Round up', hotels: 'Optional' },
  { country: 'Switzerland', restaurants: 'Service included; round up', taxis: 'Round up', hotels: 'Optional' },
  { country: 'Greece', restaurants: '5–10%, optional', taxis: 'Round up', hotels: 'Optional' },
  { country: 'Turkey', restaurants: '5–10%', taxis: 'Round up', hotels: 'Optional' },
  { country: 'Japan', restaurants: 'Not customary — can be seen as odd', taxis: 'Not customary', hotels: 'Not customary', note: 'Excellent service is the norm, not something tipped for.' },
  { country: 'South Korea', restaurants: 'Not customary', taxis: 'Not customary', hotels: 'Not customary' },
  { country: 'China', restaurants: 'Not customary, sometimes discouraged', taxis: 'Not customary', hotels: 'Small amount at high-end hotels only' },
  { country: 'India', restaurants: '5–10% if no service charge', taxis: 'Round up', hotels: '₹50–100/bag' },
  { country: 'Thailand', restaurants: '10%, or round up if no service charge', taxis: 'Round up', hotels: '20–50 baht/bag' },
  { country: 'Vietnam', restaurants: 'Round up, appreciated not expected', taxis: 'Round up', hotels: 'Small amount appreciated' },
  { country: 'Indonesia', restaurants: '10% if no service charge', taxis: 'Round up', hotels: 'Small amount appreciated' },
  { country: 'Singapore', restaurants: 'Not customary — service charge usually included', taxis: 'Not customary', hotels: 'Not customary' },
  { country: 'Malaysia', restaurants: 'Not customary, round up', taxis: 'Round up', hotels: 'Optional' },
  { country: 'Philippines', restaurants: '10% if no service charge', taxis: 'Round up', hotels: 'Small amount appreciated' },
  { country: 'United Arab Emirates', restaurants: '10% if no service charge', taxis: 'Round up', hotels: '5–10 AED/bag' },
  { country: 'Israel', restaurants: '10–15%', taxis: 'Not expected', hotels: 'Optional' },
  { country: 'Egypt', restaurants: '10%, widely expected ("baksheesh")', taxis: 'Round up', hotels: 'Small amounts expected frequently' },
  { country: 'South Africa', restaurants: '10–15%', taxis: 'Round up', hotels: 'R10–20/bag' },
  { country: 'Morocco', restaurants: '10%', taxis: 'Round up', hotels: '10–20 MAD/bag' },
  { country: 'Australia', restaurants: 'Not customary, appreciated for great service', taxis: 'Not expected', hotels: 'Not customary' },
  { country: 'New Zealand', restaurants: 'Not customary', taxis: 'Not customary', hotels: 'Not customary' },
  { country: 'Brazil', restaurants: '10% usually included on the bill', taxis: 'Round up', hotels: 'Optional' },
  { country: 'Argentina', restaurants: '10%, optional', taxis: 'Round up', hotels: 'Optional' },
]

export function findTipping(country: string): TippingInfo | null {
  const needle = country.trim().toLowerCase()
  return TIPPING_DATA.find((row) => row.country.toLowerCase() === needle) ?? null
}
