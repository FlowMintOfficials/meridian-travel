/**
 * Rough duty-free personal allowances for returning residents — the
 * general "goods" exemption most countries publish for what you can
 * bring home before customs duty applies. Deliberately a much smaller,
 * more heavily-caveated list than plugVoltage/tippingGuide: getting a
 * plug type wrong costs you an adapter, but getting a customs allowance
 * wrong can mean a real duty bill or a confiscated item. This is a
 * planning nudge, not a citable figure — thresholds vary by how long
 * you were away, arrival method, and what exactly you're carrying
 * (alcohol/tobacco/gifts usually have separate, smaller sub-limits not
 * captured here), and they change over time. Always confirm with the
 * destination's actual customs authority before relying on this.
 */

export interface CustomsAllowance {
  country: string
  currency: string
  amount: number
  note: string
}

export const CUSTOMS_ALLOWANCE_DATA: CustomsAllowance[] = [
  {
    country: 'United States',
    currency: 'USD',
    amount: 800,
    note: 'Per person, typically after 48+ hours abroad. Alcohol and tobacco have separate, smaller limits.',
  },
  {
    country: 'Canada',
    currency: 'CAD',
    amount: 800,
    note: 'Per person, after 48+ hours abroad — the exemption is lower for shorter trips.',
  },
  {
    country: 'United Kingdom',
    currency: 'GBP',
    amount: 390,
    note: 'Arriving from outside the EU; higher for private plane/boat arrivals.',
  },
  {
    country: 'European Union',
    currency: 'EUR',
    amount: 430,
    note: 'Arriving by air or sea from outside the EU (lower for land/inland-waterway arrivals).',
  },
  {
    country: 'Australia',
    currency: 'AUD',
    amount: 900,
    note: 'Per adult traveler; lower for travelers under 18.',
  },
  {
    country: 'New Zealand',
    currency: 'NZD',
    amount: 700,
    note: 'Per person.',
  },
  {
    country: 'Japan',
    currency: 'JPY',
    amount: 200_000,
    note: 'Per person; some categories are capped separately regardless of total value.',
  },
  {
    country: 'Singapore',
    currency: 'SGD',
    amount: 500,
    note: 'After 48+ hours abroad — lower for shorter trips.',
  },
  {
    country: 'South Korea',
    currency: 'USD',
    amount: 800,
    note: 'Usually quoted in USD equivalent; alcohol/tobacco/perfume have separate limits.',
  },
  {
    country: 'India',
    currency: 'INR',
    amount: 50_000,
    note: 'General allowance for used personal effects and new articles — gold/electronics follow separate, more detailed rules.',
  },
]

export function findCustomsAllowance(country: string): CustomsAllowance | null {
  const needle = country.trim().toLowerCase()
  return CUSTOMS_ALLOWANCE_DATA.find((row) => row.country.toLowerCase() === needle) ?? null
}
