export type ThemeMode = 'dark' | 'light'

export type TripType = 'beach' | 'business' | 'city' | 'camping' | 'ski' | 'roadtrip' | 'family' | 'general'

export type ViewId = 'trips' | 'trip' | 'settings' | 'help'

export interface Destination {
  city: string
  country: string
  countryCode?: string
  latitude?: number
  longitude?: number
  /** Optional per-leg date range for multi-city/multi-leg trips — the
   * span of the overall trip actually spent in this destination. Absent
   * on single-destination trips and on any destination added before this
   * existed; those behave exactly as before (implicitly, the whole trip
   * is the one leg). Both set or both absent — a leg without an end date
   * isn't a leg you can compute anything from. */
  startDate?: string
  endDate?: string
}

export interface Trip {
  id: string
  name: string
  type: TripType
  destinations: Destination[]
  startDate: string
  endDate: string
  homeCurrency: string
  tripCurrency: string
  travelerCount: number
  travelers: string[]
  archived: boolean
  /** User marked this trip finished (independent of end date). */
  completed: boolean
  completedAt?: string
  createdAt: string
  updatedAt: string
  coverGradient?: string
  notes?: string
  /** Soft budget cap in home currency. */
  budgetTarget?: number
  /** IANA timezone for local times, e.g. "Asia/Tokyo". */
  timezone?: string
}

export type PackingCategory =
  | 'essentials'
  | 'clothing'
  | 'toiletries'
  | 'electronics'
  | 'documents'
  | 'health'
  | 'gear'
  | 'kids'
  | 'other'

export type PackingStatus = 'todo' | 'packed' | 'skip'

export interface PackingItem {
  id: string
  tripId: string
  name: string
  category: PackingCategory
  quantity: number
  status: PackingStatus
  essential: boolean
  notes?: string
  order: number
}

export interface PackingTemplate {
  id: string
  name: string
  tripType: TripType
  builtin: boolean
  items: Array<{
    name: string
    category: PackingCategory
    quantity: number
    essential: boolean
    weatherTags?: WeatherTag[]
  }>
}

export type WeatherTag = 'hot' | 'warm' | 'mild' | 'cool' | 'cold' | 'rain' | 'snow' | 'sun'

export type ItineraryEventType =
  | 'transport'
  | 'flight'
  | 'train'
  | 'lodging'
  | 'food'
  | 'activity'
  | 'landmark'
  | 'note'

export interface ItineraryEvent {
  id: string
  tripId: string
  day: number
  startTime?: string
  endTime?: string
  title: string
  address?: string
  type: ItineraryEventType
  cost?: number
  costCurrency?: string
  bookingRef?: string
  bookingUrl?: string
  notes?: string
  order: number
  /** Flight / train extras */
  carrier?: string
  flightNumber?: string
  departureStation?: string
  arrivalStation?: string
  terminal?: string
  gate?: string
  seat?: string
}

export type ExpenseCategory =
  | 'lodging'
  | 'transport'
  | 'food'
  | 'activities'
  | 'shopping'
  | 'groceries'
  | 'fees'
  | 'other'

export interface Expense {
  id: string
  tripId: string
  date: string
  amount: number
  currency: string
  category: ExpenseCategory
  description: string
  paidBy?: string
  /** Who this expense is split among (defaults to all travelers when empty). */
  splitWith?: string[]
  createdAt: string
  /** Set once a receipt photo has been captured — the image blob itself
   * lives in IndexedDB under this id, same pattern as TripPhoto. */
  receiptId?: string
}

export type ChecklistStatus = 'todo' | 'done' | 'skip'

export interface ChecklistItem {
  id: string
  tripId: string
  title: string
  status: ChecklistStatus
  order: number
  dueDate?: string
  notes?: string
}

/** Metadata only — binary blobs live in IndexedDB. */
export interface TripPhoto {
  id: string
  tripId: string
  day: number
  caption?: string
  mime: string
  size: number
  createdAt: string
}

export type DocumentKind =
  | 'passport'
  | 'ticket'
  | 'insurance'
  | 'reservation'
  | 'visa'
  | 'note'
  | 'other'

export interface EncryptedDocument {
  id: string
  tripId: string
  name: string
  kind: DocumentKind
  mime: string
  /** AES-GCM ciphertext (base64). */
  encryptedData: string
  /** AES-GCM IV (base64). */
  iv: string
  /** PBKDF2 salt (base64) — unique per document. */
  salt: string
  addedAt: string
  size: number
}

export interface EmergencyContact {
  id: string
  tripId: string
  label: string
  detail: string
  kind: 'embassy' | 'insurance' | 'hospital' | 'hotel' | 'family' | 'other'
}

export type LoyaltyCategory = 'airline' | 'hotel' | 'rail' | 'car-rental' | 'other'

/** Loyalty/rewards program membership — applies across every trip, not
 * tied to any one of them, so it lives at the top level like Settings. */
export interface LoyaltyProgram {
  id: string
  provider: string
  category: LoyaltyCategory
  memberNumber: string
  tier?: string
  notes?: string
  createdAt: string
}

/** Travel insurance policy for a specific trip. */
export interface TravelInsurancePolicy {
  id: string
  tripId: string
  provider: string
  policyNumber: string
  emergencyPhone?: string
  coverageStart?: string
  coverageEnd?: string
  notes?: string
}

export type RecurringCostCadence = 'monthly' | 'yearly'
export type RecurringCostCategory = 'membership' | 'subscription' | 'insurance' | 'other'

/** A travel-related recurring cost tracked independently of any trip —
 * lounge memberships, annual travel insurance, etc. */
export interface RecurringTravelCost {
  id: string
  name: string
  amount: number
  currency: string
  cadence: RecurringCostCadence
  nextDueDate: string
  category: RecurringCostCategory
  notes?: string
  createdAt: string
}

export interface CachedCurrencyRates {
  base: string
  rates: Record<string, number>
  fetchedAt: string
}

export interface CachedWeather {
  key: string
  latitude: number
  longitude: number
  daily: Array<{
    date: string
    tempMin: number
    tempMax: number
    precipitationMm: number
    weatherCode: number
  }>
  fetchedAt: string
}

export interface Settings {
  theme: ThemeMode
  defaultHomeCurrency: string
  encryptDocuments: boolean
  /** 0 = never auto-lock. */
  autoLockMinutes: number
  /** Optional plaintext reminder for vault passphrase (never the key). */
  vaultHint?: string
  /** Browser local notifications for upcoming trips. */
  remindersEnabled: boolean
  /** Days before start date to nudge (default 3). */
  remindDaysBefore: number
}

/** Encrypted proof that a passphrase can unlock the docs vault. */
export interface VaultLock {
  salt: string
  iv: string
  verifier: string
}

export interface MeridianData {
  version: 1
  trips: Trip[]
  packing: PackingItem[]
  itinerary: ItineraryEvent[]
  expenses: Expense[]
  documents: EncryptedDocument[]
  emergencyContacts: EmergencyContact[]
  checklist: ChecklistItem[]
  photos: TripPhoto[]
  customTemplates: PackingTemplate[]
  settings: Settings
  /** Set once when the user first creates a vault passphrase. */
  vaultLock?: VaultLock
  cachedRates?: CachedCurrencyRates
  cachedWeather: CachedWeather[]
  loyaltyPrograms: LoyaltyProgram[]
  insurancePolicies: TravelInsurancePolicy[]
  recurringCosts: RecurringTravelCost[]
}
