import { fetchWithTimeout } from './fetchTimeout'
import type { CachedCurrencyRates } from '../types'

/**
 * Currency conversion via the Frankfurter API — free, no API key, no rate
 * limits, CORS-safe. Rates are ECB reference rates, updated once a day.
 *
 * The project moved from frankfurter.app to frankfurter.dev (the old
 * domain now 301-redirects). Calling the new domain directly rather than
 * relying on the redirect avoids depending on cross-origin redirect/CORS
 * behavior that varies across browsers -- this is exactly what silently
 * broke rate fetching (every currency, not just one) until this pointed
 * at the new domain. The v1 path used here is still supported going
 * forward per Frankfurter's own docs, so no request-shape changes needed.
 *
 * We only ever fetch one base at a time and cache the whole result. That
 * keeps things fast and offline-friendly.
 */

const API = 'https://api.frankfurter.dev/v1/latest'
const CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 6 hours

export const COMMON_CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
  { code: 'THB', name: 'Thai Baht', symbol: '฿' },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM' },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp' },
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱' },
  { code: 'VND', name: 'Vietnamese Dong', symbol: '₫' },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩' },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'MX$' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$' },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr' },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr' },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr' },
  { code: 'PLN', name: 'Polish Zloty', symbol: 'zł' },
  { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč' },
] as const

export function currencyMeta(code: string) {
  return COMMON_CURRENCIES.find((c) => c.code === code) ?? {
    code,
    name: code,
    symbol: code,
  }
}

/**
 * Frankfurter serves ECB reference rates, which cover most but not all
 * of COMMON_CURRENCIES — AED and VND aren't ECB reference currencies, so a
 * rate fetch for either 404s every time, no matter how often it's retried.
 * Logging expenses in these still works fine (ExpensesTab already shows a
 * "not converted" count for anything with no rate); this just lets the UI
 * explain *why* instead of showing a dead "—" that looks like a bug.
 */
const NO_LIVE_RATES = new Set(['AED', 'VND'])

export function hasLiveRates(code: string): boolean {
  return !NO_LIVE_RATES.has(code)
}

export function isCacheFresh(cached: CachedCurrencyRates | undefined, base: string): boolean {
  if (!cached) return false
  if (cached.base !== base) return false
  const age = Date.now() - new Date(cached.fetchedAt).getTime()
  return age < CACHE_TTL_MS
}

export async function fetchRates(base: string): Promise<CachedCurrencyRates> {
  const url = `${API}?from=${encodeURIComponent(base)}`
  const res = await fetchWithTimeout(url)
  if (!res.ok) throw new Error(`Rate fetch failed: ${res.status}`)
  const json = (await res.json()) as { base?: string; rates?: Record<string, number> }
  if (!json.rates || typeof json.rates !== 'object') {
    throw new Error('Rate response missing "rates"')
  }
  const rates: Record<string, number> = { ...json.rates, [base]: 1 }
  return {
    base: json.base ?? base,
    rates,
    fetchedAt: new Date().toISOString(),
  }
}

/** Convert `amount` from `from` currency to `to` currency using cached rates.
 * Returns `null` if we don't have rates for the pair. */
export function convert(
  amount: number,
  from: string,
  to: string,
  cache: CachedCurrencyRates | undefined,
): number | null {
  if (from === to) return amount
  if (!cache) return null

  // Case 1: cache base == from → straightforward
  if (cache.base === from && cache.rates[to] != null) {
    return amount * cache.rates[to]
  }

  // Case 2: cache base == to → invert
  if (cache.base === to && cache.rates[from] != null && cache.rates[from] !== 0) {
    return amount / cache.rates[from]
  }

  // Case 3: cross rate via the cache's base
  if (cache.rates[from] != null && cache.rates[to] != null && cache.rates[from] !== 0) {
    const inBase = amount / cache.rates[from]
    return inBase * cache.rates[to]
  }

  return null
}

// Expense lists / summaries call formatMoney a lot (multiple times per
// row, once per row) — constructing a new Intl.NumberFormat on every call
// is pure waste since there are at most a couple dozen distinct
// (currency, digits) pairs an app session will ever ask for.
const formatterCache = new Map<string, Intl.NumberFormat>()

function getFormatter(currency: string, digits: number): Intl.NumberFormat {
  const key = `${currency}:${digits}`
  let fmt = formatterCache.get(key)
  if (!fmt) {
    fmt = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })
    formatterCache.set(key, fmt)
  }
  return fmt
}

export function formatMoney(amount: number, currency: string, digits = 2): string {
  try {
    return getFormatter(currency, digits).format(amount)
  } catch {
    const meta = currencyMeta(currency)
    return `${meta.symbol}${amount.toFixed(digits)}`
  }
}

export function formatMoneyCompact(amount: number, currency: string): string {
  const abs = Math.abs(amount)
  if (abs >= 100_000) return formatMoney(amount, currency, 0)
  if (abs >= 1_000) return formatMoney(amount, currency, 0)
  return formatMoney(amount, currency, 2)
}
