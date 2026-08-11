import { convert } from './currency'
import type { CachedCurrencyRates, Expense, Trip } from '../types'

export interface Settlement {
  from: string
  to: string
  amount: number
}

export interface BalanceRow {
  name: string
  paid: number
  share: number
  net: number
}

/**
 * Equal-split settlement among travelers.
 * Each expense is divided among `splitWith` (or all trip travelers / paidBy alone).
 */
export function computeBalances(
  trip: Trip,
  expenses: Expense[],
  rates: CachedCurrencyRates | undefined,
): { balances: BalanceRow[]; settlements: Settlement[]; total: number } {
  const people = [...new Set(trip.travelers.filter(Boolean))]
  // Membership checks below run per-expense (and per-splitter, per-expense)
  // — a Set keeps that O(1) instead of an O(M) `Array.includes` scan on
  // every check, which matters once trip size (M travelers × N expenses)
  // grows for a large group trip.
  const peopleSet = new Set(people)
  if (people.length === 0) {
    // Fall back to payers named on expenses
    for (const e of expenses) {
      if (e.paidBy && !peopleSet.has(e.paidBy)) {
        people.push(e.paidBy)
        peopleSet.add(e.paidBy)
      }
    }
  }

  const paid = new Map<string, number>()
  const share = new Map<string, number>()
  for (const p of people) {
    paid.set(p, 0)
    share.set(p, 0)
  }

  let total = 0

  for (const e of expenses) {
    const inHome = convert(e.amount, e.currency, trip.homeCurrency, rates)
    if (inHome == null) continue
    total += inHome

    const payer = e.paidBy && peopleSet.has(e.paidBy) ? e.paidBy : null
    if (payer) paid.set(payer, (paid.get(payer) ?? 0) + inHome)

    let splitters =
      e.splitWith && e.splitWith.length > 0
        ? e.splitWith.filter((n) => peopleSet.has(n))
        : people.length > 0
          ? people
          : payer
            ? [payer]
            : []

    if (splitters.length === 0) continue
    const each = inHome / splitters.length
    for (const n of splitters) {
      share.set(n, (share.get(n) ?? 0) + each)
    }
  }

  const balances: BalanceRow[] = people.map((name) => {
    const p = paid.get(name) ?? 0
    const s = share.get(name) ?? 0
    return { name, paid: p, share: s, net: p - s }
  })

  // Greedy settle: debtors pay creditors
  const debtors = balances
    .filter((b) => b.net < -0.005)
    .map((b) => ({ name: b.name, amount: -b.net }))
    .sort((a, b) => b.amount - a.amount)
  const creditors = balances
    .filter((b) => b.net > 0.005)
    .map((b) => ({ name: b.name, amount: b.net }))
    .sort((a, b) => b.amount - a.amount)

  const settlements: Settlement[] = []
  let i = 0
  let j = 0
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amount, creditors[j].amount)
    if (pay > 0.005) {
      settlements.push({
        from: debtors[i].name,
        to: creditors[j].name,
        amount: pay,
      })
    }
    debtors[i].amount -= pay
    creditors[j].amount -= pay
    if (debtors[i].amount <= 0.005) i += 1
    if (creditors[j].amount <= 0.005) j += 1
  }

  return { balances, settlements, total }
}
