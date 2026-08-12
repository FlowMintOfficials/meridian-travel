import type { IconName } from '../components/Icon'
import type { ExpenseCategory } from '../types'

export const CATEGORY_META: Record<ExpenseCategory, { label: string; icon: IconName; color: string }> = {
  lodging: { label: 'Lodging', icon: 'building', color: '#38bdf8' },
  transport: { label: 'Transport', icon: 'plane', color: '#818cf8' },
  food: { label: 'Food & drink', icon: 'utensils', color: '#fbbf24' },
  activities: { label: 'Activities', icon: 'sparkle', color: '#2dd4bf' },
  shopping: { label: 'Shopping', icon: 'creditCard', color: '#f472b6' },
  groceries: { label: 'Groceries', icon: 'coffee', color: '#34d399' },
  fees: { label: 'Fees & tips', icon: 'receipt', color: '#94a3b8' },
  other: { label: 'Other', icon: 'more', color: '#64748b' },
}

export const CATEGORIES: ExpenseCategory[] = [
  'lodging',
  'transport',
  'food',
  'activities',
  'shopping',
  'groceries',
  'fees',
  'other',
]
