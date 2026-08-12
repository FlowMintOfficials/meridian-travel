/** Mains power by country — plug type letters (per the IEC/World Standards
 * naming), nominal voltage, and frequency. Bundled since this basically
 * never changes (unlike currency rates or visa rules), so there's no
 * staleness risk in shipping it as a static dataset. Not exhaustive —
 * covers common travel destinations, with a graceful "no data" fallback
 * for anything else. */

export interface PlugVoltageInfo {
  country: string
  plugTypes: string[]
  voltage: string
  frequency: string
}

export const PLUG_VOLTAGE_DATA: PlugVoltageInfo[] = [
  { country: 'United States', plugTypes: ['A', 'B'], voltage: '120V', frequency: '60Hz' },
  { country: 'Canada', plugTypes: ['A', 'B'], voltage: '120V', frequency: '60Hz' },
  { country: 'Mexico', plugTypes: ['A', 'B'], voltage: '127V', frequency: '60Hz' },
  { country: 'United Kingdom', plugTypes: ['G'], voltage: '230V', frequency: '50Hz' },
  { country: 'Ireland', plugTypes: ['G'], voltage: '230V', frequency: '50Hz' },
  { country: 'France', plugTypes: ['C', 'E'], voltage: '230V', frequency: '50Hz' },
  { country: 'Germany', plugTypes: ['C', 'F'], voltage: '230V', frequency: '50Hz' },
  { country: 'Spain', plugTypes: ['C', 'F'], voltage: '230V', frequency: '50Hz' },
  { country: 'Italy', plugTypes: ['C', 'F', 'L'], voltage: '230V', frequency: '50Hz' },
  { country: 'Portugal', plugTypes: ['C', 'F'], voltage: '230V', frequency: '50Hz' },
  { country: 'Netherlands', plugTypes: ['C', 'F'], voltage: '230V', frequency: '50Hz' },
  { country: 'Belgium', plugTypes: ['C', 'E'], voltage: '230V', frequency: '50Hz' },
  { country: 'Switzerland', plugTypes: ['C', 'J'], voltage: '230V', frequency: '50Hz' },
  { country: 'Austria', plugTypes: ['C', 'F'], voltage: '230V', frequency: '50Hz' },
  { country: 'Greece', plugTypes: ['C', 'F'], voltage: '230V', frequency: '50Hz' },
  { country: 'Sweden', plugTypes: ['C', 'F'], voltage: '230V', frequency: '50Hz' },
  { country: 'Norway', plugTypes: ['C', 'F'], voltage: '230V', frequency: '50Hz' },
  { country: 'Denmark', plugTypes: ['C', 'K'], voltage: '230V', frequency: '50Hz' },
  { country: 'Finland', plugTypes: ['C', 'F'], voltage: '230V', frequency: '50Hz' },
  { country: 'Poland', plugTypes: ['C', 'E'], voltage: '230V', frequency: '50Hz' },
  { country: 'Czech Republic', plugTypes: ['C', 'E'], voltage: '230V', frequency: '50Hz' },
  { country: 'Croatia', plugTypes: ['C', 'F'], voltage: '230V', frequency: '50Hz' },
  { country: 'Turkey', plugTypes: ['C', 'F'], voltage: '230V', frequency: '50Hz' },
  { country: 'Russia', plugTypes: ['C', 'F'], voltage: '220V', frequency: '50Hz' },
  { country: 'Iceland', plugTypes: ['C', 'F'], voltage: '230V', frequency: '50Hz' },
  { country: 'Japan', plugTypes: ['A', 'B'], voltage: '100V', frequency: '50/60Hz' },
  { country: 'South Korea', plugTypes: ['C', 'F'], voltage: '220V', frequency: '60Hz' },
  { country: 'China', plugTypes: ['A', 'C', 'I'], voltage: '220V', frequency: '50Hz' },
  { country: 'India', plugTypes: ['C', 'D', 'M'], voltage: '230V', frequency: '50Hz' },
  { country: 'Thailand', plugTypes: ['A', 'C', 'O'], voltage: '220V', frequency: '50Hz' },
  { country: 'Vietnam', plugTypes: ['A', 'C'], voltage: '220V', frequency: '50Hz' },
  { country: 'Indonesia', plugTypes: ['C', 'F'], voltage: '230V', frequency: '50Hz' },
  { country: 'Malaysia', plugTypes: ['G'], voltage: '240V', frequency: '50Hz' },
  { country: 'Singapore', plugTypes: ['G'], voltage: '230V', frequency: '50Hz' },
  { country: 'Philippines', plugTypes: ['A', 'B', 'C'], voltage: '220V', frequency: '60Hz' },
  { country: 'Taiwan', plugTypes: ['A', 'B'], voltage: '110V', frequency: '60Hz' },
  { country: 'Hong Kong', plugTypes: ['G'], voltage: '220V', frequency: '50Hz' },
  { country: 'United Arab Emirates', plugTypes: ['C', 'G'], voltage: '230V', frequency: '50Hz' },
  { country: 'Saudi Arabia', plugTypes: ['A', 'B', 'G'], voltage: '127/220V', frequency: '60Hz' },
  { country: 'Israel', plugTypes: ['C', 'H'], voltage: '230V', frequency: '50Hz' },
  { country: 'Egypt', plugTypes: ['C', 'F'], voltage: '220V', frequency: '50Hz' },
  { country: 'South Africa', plugTypes: ['C', 'D', 'M', 'N'], voltage: '230V', frequency: '50Hz' },
  { country: 'Morocco', plugTypes: ['C', 'E'], voltage: '220V', frequency: '50Hz' },
  { country: 'Kenya', plugTypes: ['G'], voltage: '240V', frequency: '50Hz' },
  { country: 'Nigeria', plugTypes: ['D', 'G'], voltage: '230V', frequency: '50Hz' },
  { country: 'Australia', plugTypes: ['I'], voltage: '230V', frequency: '50Hz' },
  { country: 'New Zealand', plugTypes: ['I'], voltage: '230V', frequency: '50Hz' },
  { country: 'Brazil', plugTypes: ['C', 'N'], voltage: '127/220V', frequency: '60Hz' },
  { country: 'Argentina', plugTypes: ['C', 'I'], voltage: '220V', frequency: '50Hz' },
  { country: 'Chile', plugTypes: ['C', 'L'], voltage: '220V', frequency: '50Hz' },
  { country: 'Peru', plugTypes: ['A', 'C'], voltage: '220V', frequency: '60Hz' },
  { country: 'Colombia', plugTypes: ['A', 'B'], voltage: '110V', frequency: '60Hz' },
  { country: 'Costa Rica', plugTypes: ['A', 'B'], voltage: '120V', frequency: '60Hz' },
]

export function findPlugVoltage(country: string): PlugVoltageInfo | null {
  const needle = country.trim().toLowerCase()
  return (
    PLUG_VOLTAGE_DATA.find(
      (row) => row.country.toLowerCase() === needle,
    ) ?? null
  )
}
