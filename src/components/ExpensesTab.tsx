import { useMemo, useState, type FormEvent } from 'react'
import { Icon, type IconName } from './Icon'
import { EmptyState } from './EmptyState'
import { Dialog } from './Dialog'
import { COMMON_CURRENCIES, convert, formatMoney, isCacheFresh } from '../lib/currency'
import { computeBalances } from '../lib/billSplit'
import { todayISO, formatShortDate } from '../lib/tripHelpers'
import type { ToastFn } from './Toast'
import type { Expense, ExpenseCategory, MeridianData, Trip } from '../types'
import type { MeridianStore } from '../hooks/useMeridian'

interface ExpensesTabProps {
  trip: Trip
  data: MeridianData
  store: MeridianStore
  onToast: ToastFn
}

const CATEGORY_META: Record<
  ExpenseCategory,
  { label: string; icon: IconName; color: string }
> = {
  lodging: { label: 'Lodging', icon: 'building', color: '#38bdf8' },
  transport: { label: 'Transport', icon: 'plane', color: '#818cf8' },
  food: { label: 'Food & drink', icon: 'utensils', color: '#fbbf24' },
  activities: { label: 'Activities', icon: 'sparkle', color: '#2dd4bf' },
  shopping: { label: 'Shopping', icon: 'creditCard', color: '#f472b6' },
  groceries: { label: 'Groceries', icon: 'coffee', color: '#34d399' },
  fees: { label: 'Fees & tips', icon: 'receipt', color: '#94a3b8' },
  other: { label: 'Other', icon: 'more', color: '#64748b' },
}

const CATEGORIES: ExpenseCategory[] = [
  'lodging',
  'transport',
  'food',
  'activities',
  'shopping',
  'groceries',
  'fees',
  'other',
]

export function ExpensesTab({ trip, data, store, onToast }: ExpensesTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)

  const expenses = useMemo(
    () =>
      data.expenses
        .filter((e) => e.tripId === trip.id)
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    [data.expenses, trip.id],
  )

  const totalInHome = useMemo(() => {
    let total = 0
    let unconverted = 0
    for (const e of expenses) {
      const inHome = convert(e.amount, e.currency, trip.homeCurrency, data.cachedRates)
      if (inHome != null) total += inHome
      else unconverted += 1
    }
    return { total, unconverted }
  }, [expenses, trip.homeCurrency, data.cachedRates])

  const byCategory = useMemo(() => {
    const map = new Map<ExpenseCategory, number>()
    for (const e of expenses) {
      const inHome = convert(e.amount, e.currency, trip.homeCurrency, data.cachedRates)
      if (inHome == null) continue
      map.set(e.category, (map.get(e.category) ?? 0) + inHome)
    }
    return map
  }, [expenses, trip.homeCurrency, data.cachedRates])

  const byDay = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>()
    for (const e of expenses) {
      const inHome = convert(e.amount, e.currency, trip.homeCurrency, data.cachedRates)
      if (inHome == null) continue
      const bucket = map.get(e.date) ?? { total: 0, count: 0 }
      bucket.total += inHome
      bucket.count += 1
      map.set(e.date, bucket)
    }
    return map
  }, [expenses, trip.homeCurrency, data.cachedRates])

  const dailyAvg =
    byDay.size === 0
      ? 0
      : Array.from(byDay.values()).reduce((s, v) => s + v.total, 0) / byDay.size

  const budgetTarget = trip.budgetTarget
  const budgetRemaining =
    budgetTarget != null ? budgetTarget - totalInHome.total : null
  const budgetPct =
    budgetTarget && budgetTarget > 0
      ? Math.min(100, Math.round((totalInHome.total / budgetTarget) * 100))
      : 0
  const overBudget = budgetRemaining != null && budgetRemaining < 0

  const split = useMemo(
    () => computeBalances(trip, expenses, data.cachedRates),
    [trip, expenses, data.cachedRates],
  )

  const [budgetDraft, setBudgetDraft] = useState(
    trip.budgetTarget != null ? String(trip.budgetTarget) : '',
  )

  const handleSubmit = (input: ExpenseFormValue) => {
    if (editing) {
      store.updateExpense(editing.id, {
        amount: input.amount,
        currency: input.currency,
        category: input.category,
        description: input.description,
        date: input.date,
        paidBy: input.paidBy || undefined,
        splitWith: input.splitWith.length ? input.splitWith : undefined,
      })
      onToast('Expense updated.', 'success')
    } else {
      store.addExpense(trip.id, {
        ...input,
        paidBy: input.paidBy || undefined,
        splitWith: input.splitWith.length ? input.splitWith : undefined,
      })
      onToast(
        `Logged ${formatMoney(input.amount, input.currency)} for ${CATEGORY_META[input.category].label}.`,
        'success',
      )
    }
    setDialogOpen(false)
    setEditing(null)
  }

  const saveBudget = () => {
    const n = Number(budgetDraft)
    store.updateTrip(trip.id, {
      budgetTarget: Number.isFinite(n) && n > 0 ? n : undefined,
    })
    onToast(
      Number.isFinite(n) && n > 0
        ? `Budget set to ${formatMoney(n, trip.homeCurrency, 0)}.`
        : 'Budget cleared.',
      'success',
    )
  }

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const openEdit = (exp: Expense) => {
    setEditing(exp)
    setDialogOpen(true)
  }

  const handleDelete = (exp: Expense) => {
    store.deleteExpense(exp.id)
    onToast(`${CATEGORY_META[exp.category].label} expense removed.`, 'info', {
      label: 'Undo',
      onClick: () => store.restoreExpense(exp),
    })
  }

  if (expenses.length === 0) {
    return (
      <div className="exp">
        <div className="exp-budget">
          <p className="exp-eyebrow">
            <Icon name="chart" size={12} /> Trip budget
          </p>
          <div className="exp-budget-edit">
            <input
              className="input mono"
              type="number"
              min={0}
              step={1}
              value={budgetDraft}
              onChange={(e) => setBudgetDraft(e.target.value)}
              placeholder={`Target in ${trip.homeCurrency}`}
            />
            <button type="button" className="btn" onClick={saveBudget}>
              Save
            </button>
          </div>
        </div>
        <EmptyState
          icon="wallet"
          title="No expenses yet"
          description={`Log each purchase in the local currency (${trip.tripCurrency}). Meridian converts to your home currency (${trip.homeCurrency}) using live cached rates.`}
          action={
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              <Icon name="plus" size={14} /> Log first expense
            </button>
          }
        />

        {dialogOpen && (
          <ExpenseDialog
            open
            onClose={() => setDialogOpen(false)}
            defaultCurrency={trip.tripCurrency}
            travelers={trip.travelers}
            existing={editing}
            onSubmit={handleSubmit}
          />
        )}
      </div>
    )
  }

  const grandTotalMax = Math.max(...Array.from(byCategory.values()), 1)

  return (
    <section className="exp">
      <div className="exp-summary">
        <div className="exp-total">
          <p className="exp-eyebrow">
            <Icon name="wallet" size={12} /> Total spent
          </p>
          <strong className="mono">
            {formatMoney(totalInHome.total, trip.homeCurrency, 0)}
          </strong>
          <small>
            in {trip.homeCurrency}
            {totalInHome.unconverted > 0 && (
              <>
                <span className="pack-dot">·</span>
                <span style={{ color: 'var(--warning)' }}>
                  {totalInHome.unconverted} not converted
                </span>
              </>
            )}
          </small>
        </div>
        <div className="exp-daily">
          <p className="exp-eyebrow">
            <Icon name="clock" size={12} /> Daily average
          </p>
          <strong className="mono">
            {byDay.size === 0
              ? '—'
              : formatMoney(dailyAvg, trip.homeCurrency, 0)}
          </strong>
          <small>
            across {byDay.size} day{byDay.size !== 1 && 's'}
          </small>
        </div>
        <div className="exp-count">
          <p className="exp-eyebrow">
            <Icon name="receipt" size={12} /> Entries
          </p>
          <strong className="mono">{expenses.length}</strong>
          <small>logged</small>
        </div>
        <button type="button" className="btn btn-primary exp-add" onClick={openCreate}>
          <Icon name="plus" size={14} /> Log expense
        </button>
      </div>

      <div className="exp-budget">
        <div className="exp-budget-head">
          <p className="exp-eyebrow">
            <Icon name="chart" size={12} /> Trip budget
          </p>
          {budgetTarget != null && (
            <span className={`chip ${overBudget ? 'danger' : 'accent'}`}>
              {overBudget
                ? `${formatMoney(Math.abs(budgetRemaining!), trip.homeCurrency, 0)} over`
                : `${formatMoney(budgetRemaining!, trip.homeCurrency, 0)} left`}
            </span>
          )}
        </div>
        {budgetTarget != null && (
          <div className="exp-budget-bar" aria-hidden>
            <div
              className={`exp-budget-fill ${overBudget ? 'over' : ''}`}
              style={{ width: `${Math.min(100, budgetPct)}%` }}
            />
          </div>
        )}
        <div className="exp-budget-edit">
          <input
            className="input mono"
            type="number"
            min={0}
            step={1}
            value={budgetDraft}
            onChange={(e) => setBudgetDraft(e.target.value)}
            placeholder={`Target in ${trip.homeCurrency}`}
          />
          <button type="button" className="btn" onClick={saveBudget}>
            Save
          </button>
        </div>
      </div>

      {trip.travelers.length >= 2 && split.balances.length >= 2 && (
        <div className="exp-split">
          <p className="exp-eyebrow">
            <Icon name="users" size={12} /> Settle up
          </p>
          {split.settlements.length === 0 ? (
            <p className="exp-split-ok">Everyone is even (or no shared payers logged).</p>
          ) : (
            <ul className="exp-settle-list">
              {split.settlements.map((s) => (
                <li key={`${s.from}-${s.to}`}>
                  <strong>{s.from}</strong> pays <strong>{s.to}</strong>
                  <span className="mono">{formatMoney(s.amount, trip.homeCurrency)}</span>
                </li>
              ))}
            </ul>
          )}
          <ul className="exp-balance-list">
            {split.balances.map((b) => (
              <li key={b.name}>
                <span>{b.name}</span>
                <span className={`mono ${b.net >= 0 ? 'pos' : 'neg'}`}>
                  {b.net >= 0 ? '+' : ''}
                  {formatMoney(b.net, trip.homeCurrency)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {byCategory.size > 0 && (
        <div className="exp-breakdown">
          <p className="exp-eyebrow">
            <Icon name="chart" size={12} /> By category
          </p>
          <ul className="exp-cat-list">
            {CATEGORIES.filter((c) => byCategory.has(c)).map((cat) => {
              const amount = byCategory.get(cat) ?? 0
              const pct = Math.round((amount / totalInHome.total) * 100)
              const meta = CATEGORY_META[cat]
              return (
                <li key={cat}>
                  <span
                    className="exp-cat-icon"
                    style={{ background: meta.color, color: '#042018' }}
                    aria-hidden
                  >
                    <Icon name={meta.icon} size={12} />
                  </span>
                  <span className="exp-cat-label">{meta.label}</span>
                  <div className="exp-cat-bar" aria-hidden>
                    <div
                      className="exp-cat-fill"
                      style={{
                        width: `${(amount / grandTotalMax) * 100}%`,
                        background: meta.color,
                      }}
                    />
                  </div>
                  <span className="exp-cat-amount mono">
                    {formatMoney(amount, trip.homeCurrency, 0)}
                  </span>
                  <span className="exp-cat-pct mono">{pct}%</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <div className="exp-list">
        <p className="exp-eyebrow">
          <Icon name="receipt" size={12} /> Log
        </p>
        <ul>
          {expenses.map((exp) => {
            const meta = CATEGORY_META[exp.category]
            const inHome = convert(
              exp.amount,
              exp.currency,
              trip.homeCurrency,
              data.cachedRates,
            )
            return (
              <li key={exp.id} className="exp-item">
                <span
                  className="exp-cat-icon"
                  style={{ background: meta.color, color: '#042018' }}
                  aria-hidden
                >
                  <Icon name={meta.icon} size={13} />
                </span>
                <div className="exp-item-copy">
                  <div className="exp-item-title">
                    <strong>{exp.description || meta.label}</strong>
                    <span className="exp-item-date">{formatShortDate(exp.date)}</span>
                  </div>
                  <div className="exp-item-meta">
                    <span className="chip">{meta.label}</span>
                    {exp.paidBy && (
                      <span className="chip">
                        <Icon name="users" size={10} /> {exp.paidBy}
                      </span>
                    )}
                  </div>
                </div>
                <div className="exp-item-amounts">
                  <strong className="mono">{formatMoney(exp.amount, exp.currency)}</strong>
                  {exp.currency !== trip.homeCurrency && inHome != null && (
                    <small className="mono">≈ {formatMoney(inHome, trip.homeCurrency)}</small>
                  )}
                </div>
                <div className="exp-item-actions">
                  <button
                    type="button"
                    className="pack-mini"
                    onClick={() => openEdit(exp)}
                    aria-label="Edit"
                  >
                    <Icon name="edit" size={12} />
                  </button>
                  <button
                    type="button"
                    className="pack-mini danger"
                    onClick={() => handleDelete(exp)}
                    aria-label="Delete"
                  >
                    <Icon name="trash" size={12} />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      {data.cachedRates && (
        <p className="exp-fresh">
          Rates last refreshed {new Date(data.cachedRates.fetchedAt).toLocaleString()} ·{' '}
          <span
            style={{
              color: isCacheFresh(data.cachedRates, trip.homeCurrency)
                ? 'var(--success)'
                : 'var(--warning)',
            }}
          >
            {isCacheFresh(data.cachedRates, trip.homeCurrency) ? 'fresh' : 'stale — refresh in Overview'}
          </span>
        </p>
      )}

      {dialogOpen && (
        <ExpenseDialog
          open
          onClose={() => {
            setDialogOpen(false)
            setEditing(null)
          }}
          defaultCurrency={trip.tripCurrency}
          travelers={trip.travelers}
          existing={editing}
          onSubmit={handleSubmit}
        />
      )}
    </section>
  )
}

// -------------------------------------------------------------------

interface ExpenseFormValue {
  amount: number
  currency: string
  category: ExpenseCategory
  description: string
  date: string
  paidBy: string
  splitWith: string[]
}

interface ExpenseDialogProps {
  open: boolean
  onClose: () => void
  defaultCurrency: string
  travelers: string[]
  existing: Expense | null
  onSubmit: (value: ExpenseFormValue) => void
}

function ExpenseDialog({
  open,
  onClose,
  defaultCurrency,
  travelers,
  existing,
  onSubmit,
}: ExpenseDialogProps) {
  const [amount, setAmount] = useState<string>(
    existing ? String(existing.amount) : '',
  )
  const [currency, setCurrency] = useState(existing?.currency ?? defaultCurrency)
  const [category, setCategory] = useState<ExpenseCategory>(existing?.category ?? 'food')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [date, setDate] = useState(existing?.date ?? todayISO())
  const [paidBy, setPaidBy] = useState(existing?.paidBy ?? '')
  const [splitWith, setSplitWith] = useState<string[]>(
    existing?.splitWith ?? travelers,
  )

  const canSubmit = Number(amount) > 0

  const toggleSplit = (name: string) => {
    setSplitWith((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    )
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!canSubmit) return
    onSubmit({
      amount: Number(amount),
      currency,
      category,
      description: description.trim(),
      date,
      paidBy: paidBy.trim(),
      splitWith,
    })
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={existing ? 'Edit expense' : 'Log an expense'}
      size="md"
      footer={
        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="exp-form"
            className="btn btn-primary"
            disabled={!canSubmit}
          >
            <Icon name="check" size={14} />
            {existing ? 'Save' : 'Log expense'}
          </button>
        </div>
      }
    >
      <form id="exp-form" onSubmit={handleSubmit} className="trip-form">
        <div className="label">
          <span>Category</span>
          <div className="type-chips">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                className={`type-chip ${category === c ? 'active' : ''}`}
                onClick={() => setCategory(c)}
              >
                <Icon name={CATEGORY_META[c].icon} size={13} />
                {CATEGORY_META[c].label}
              </button>
            ))}
          </div>
        </div>

        <div className="row-2">
          <label className="label">
            <span>Amount</span>
            <input
              className="input mono"
              type="number"
              step="0.01"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              autoFocus
              required
            />
          </label>
          <label className="label">
            <span>Currency</span>
            <select
              className="select"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {COMMON_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="label">
          <span>Description</span>
          <input
            className="input"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Dinner at Coco's, Uber to airport, entry fee…"
          />
        </label>

        <div className="row-2">
          <label className="label">
            <span>Date</span>
            <input
              className="input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>
          <label className="label">
            <span>Paid by (optional)</span>
            {travelers.length > 0 ? (
              <select
                className="select"
                value={paidBy}
                onChange={(e) => setPaidBy(e.target.value)}
              >
                <option value="">— not set —</option>
                {travelers.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="input"
                type="text"
                value={paidBy}
                onChange={(e) => setPaidBy(e.target.value)}
                placeholder="Optional"
              />
            )}
          </label>
        </div>

        {travelers.length >= 2 && (
          <div className="label">
            <span>Split with</span>
            <div className="type-chips type-chips-compact">
              {travelers.map((name) => (
                <button
                  key={name}
                  type="button"
                  className={`type-chip ${splitWith.includes(name) ? 'active' : ''}`}
                  onClick={() => toggleSplit(name)}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}
      </form>
    </Dialog>
  )
}
