import type { MeridianData, Settings, VaultLock } from '../types'

const STORAGE_KEY = 'meridian:data:v1'
const THEME_KEY = 'meridian:theme'

const defaultSettings: Settings = {
  theme: 'dark',
  defaultHomeCurrency: 'USD',
  encryptDocuments: true,
  autoLockMinutes: 0,
  remindersEnabled: false,
  remindDaysBefore: 3,
}

export function createBlankData(): MeridianData {
  return {
    version: 1,
    trips: [],
    packing: [],
    itinerary: [],
    expenses: [],
    documents: [],
    emergencyContacts: [],
    checklist: [],
    photos: [],
    customTemplates: [],
    settings: { ...defaultSettings },
    cachedWeather: [],
    loyaltyPrograms: [],
    insurancePolicies: [],
    recurringCosts: [],
  }
}

function normalizeVaultLock(raw: unknown): VaultLock | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const v = raw as Partial<VaultLock>
  if (
    typeof v.salt === 'string' &&
    typeof v.iv === 'string' &&
    typeof v.verifier === 'string'
  ) {
    return { salt: v.salt, iv: v.iv, verifier: v.verifier }
  }
  return undefined
}

function normalize(data: Partial<MeridianData>): MeridianData {
  const settings = data.settings ?? ({} as Partial<Settings>)
  return {
    version: 1,
    trips: (data.trips ?? []).map((t) => ({
      ...t,
      // Trips saved by an older app version (or a hand-trimmed backup) can
      // be missing these — every trip render (destinationSummary, the
      // traveler chips, bill-split) assumes they're always arrays/numbers,
      // so a trip without them crashes the whole app with no error boundary
      // to catch it. Backfill rather than trust the stored shape.
      destinations: Array.isArray(t.destinations) ? t.destinations : [],
      travelers: Array.isArray(t.travelers)
        ? t.travelers.filter((n) => typeof n === 'string')
        : [],
      travelerCount:
        typeof t.travelerCount === 'number' && t.travelerCount > 0
          ? t.travelerCount
          : 1,
      archived: Boolean(t.archived),
      completed: Boolean(t.completed),
      completedAt: typeof t.completedAt === 'string' ? t.completedAt : undefined,
      budgetTarget:
        typeof t.budgetTarget === 'number' && Number.isFinite(t.budgetTarget)
          ? t.budgetTarget
          : undefined,
      timezone: typeof t.timezone === 'string' ? t.timezone : undefined,
      notes: typeof t.notes === 'string' ? t.notes : undefined,
    })),
    packing: data.packing ?? [],
    itinerary: (data.itinerary ?? []).map((e) => ({
      ...e,
      type: e.type ?? 'activity',
    })),
    expenses: (data.expenses ?? []).map((e) => ({
      ...e,
      splitWith: Array.isArray(e.splitWith) ? e.splitWith.filter((n) => typeof n === 'string') : undefined,
    })),
    documents: (data.documents ?? []).map((doc) => ({
      ...doc,
      salt: typeof doc.salt === 'string' ? doc.salt : '',
    })),
    emergencyContacts: data.emergencyContacts ?? [],
    checklist: data.checklist ?? [],
    photos: data.photos ?? [],
    customTemplates: data.customTemplates ?? [],
    settings: {
      theme: settings.theme === 'light' ? 'light' : 'dark',
      defaultHomeCurrency: settings.defaultHomeCurrency ?? defaultSettings.defaultHomeCurrency,
      encryptDocuments: settings.encryptDocuments ?? defaultSettings.encryptDocuments,
      autoLockMinutes:
        typeof settings.autoLockMinutes === 'number'
          ? Math.max(0, settings.autoLockMinutes)
          : defaultSettings.autoLockMinutes,
      vaultHint: typeof settings.vaultHint === 'string' ? settings.vaultHint : undefined,
      remindersEnabled: Boolean(settings.remindersEnabled),
      remindDaysBefore:
        typeof settings.remindDaysBefore === 'number'
          ? Math.max(1, settings.remindDaysBefore)
          : defaultSettings.remindDaysBefore,
    },
    vaultLock: normalizeVaultLock(data.vaultLock),
    cachedRates: data.cachedRates,
    cachedWeather: data.cachedWeather ?? [],
    loyaltyPrograms: Array.isArray(data.loyaltyPrograms) ? data.loyaltyPrograms : [],
    insurancePolicies: Array.isArray(data.insurancePolicies) ? data.insurancePolicies : [],
    recurringCosts: Array.isArray(data.recurringCosts) ? data.recurringCosts : [],
  }
}

export function loadData(): MeridianData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createBlankData()
    const parsed = JSON.parse(raw) as Partial<MeridianData>
    return normalize(parsed)
  } catch (err) {
    console.warn('[meridian] failed to parse saved data, starting fresh', err)
    return createBlankData()
  }
}

/** Returns false on failure (e.g. quota exceeded) instead of swallowing it
 * entirely — this is the user's only copy of their data, so a silent write
 * failure is a silent data-loss risk. Callers surface this to the user. */
export function saveData(data: MeridianData): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    return true
  } catch (err) {
    console.warn('[meridian] failed to persist data', err)
    return false
  }
}

export function exportData(data: MeridianData): string {
  return JSON.stringify(data, null, 2)
}

export function importData(json: string): MeridianData {
  const parsed = JSON.parse(json) as Partial<MeridianData>
  return normalize(parsed)
}

export function getSavedTheme(): 'dark' | 'light' | null {
  const raw = localStorage.getItem(THEME_KEY)
  return raw === 'dark' || raw === 'light' ? raw : null
}

export function saveTheme(theme: 'dark' | 'light'): void {
  localStorage.setItem(THEME_KEY, theme)
}

export function wipe(): void {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(THEME_KEY)
}
