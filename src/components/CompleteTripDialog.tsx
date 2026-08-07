import { useEffect, useState } from 'react'
import { Dialog } from './Dialog'
import { Icon } from './Icon'
import { getTripCompletionChecks } from '../lib/tripHelpers'
import type { MeridianData, Trip } from '../types'
import type { MeridianStore } from '../hooks/useMeridian'

interface CompleteTripDialogProps {
  trip: Trip
  data: MeridianData
  store: MeridianStore
  onClose: () => void
  onNavigateTab: (tab: 'packing' | 'expenses') => void
  onCompleted: () => void
}

export function CompleteTripDialog({
  trip,
  data,
  store,
  onClose,
  onNavigateTab,
  onCompleted,
}: CompleteTripDialogProps) {
  const checks = getTripCompletionChecks(trip.id, data)
  const [noExpensesConfirm, setNoExpensesConfirm] = useState(false)
  const [noPackingConfirm, setNoPackingConfirm] = useState(false)

  // Reset acknowledgements when counts change (e.g. user logged an expense).
  useEffect(() => {
    if (checks.expenseCount > 0) setNoExpensesConfirm(false)
  }, [checks.expenseCount])

  useEffect(() => {
    if (checks.packingTotal > 0) setNoPackingConfirm(false)
  }, [checks.packingTotal])

  const packingOk =
    checks.packingReady && (checks.packingTotal > 0 || noPackingConfirm)
  const budgetOk = checks.budgetReady || noExpensesConfirm
  const canComplete = packingOk && budgetOk

  const confirmComplete = () => {
    if (!canComplete) return
    store.completeTrip(trip.id)
    onCompleted()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Before you wrap up"
      subtitle="Confirm packing and budget so your trip summary is accurate."
      size="md"
      footer={
        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Keep editing
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canComplete}
            onClick={confirmComplete}
          >
            <Icon name="check" size={14} /> Complete trip
          </button>
        </div>
      }
    >
      <ul className="complete-checks">
        <li className={`complete-check ${packingOk ? 'ok' : 'warn'}`}>
          <Icon name={packingOk ? 'check' : 'suitcase'} size={16} />
          <div className="complete-check-body">
            <strong>Packing</strong>
            {checks.packingTotal === 0 ? (
              <p>No packing list yet. Add items you brought, or confirm you didn’t use one.</p>
            ) : checks.packingUnresolved > 0 ? (
              <p>
                {checks.packingUnresolved} item
                {checks.packingUnresolved !== 1 ? 's' : ''} still unmarked. Mark what you
                brought as packed, and skip anything you left behind.
              </p>
            ) : (
              <p>
                {checks.packingPacked} packed
                {checks.packingSkipped > 0
                  ? ` · ${checks.packingSkipped} skipped`
                  : ''}{' '}
                — all set.
              </p>
            )}

            {checks.packingTotal === 0 && (
              <label className="complete-confirm">
                <input
                  type="checkbox"
                  checked={noPackingConfirm}
                  onChange={(e) => setNoPackingConfirm(e.target.checked)}
                />
                I didn’t keep a packing list for this trip
              </label>
            )}

            {checks.packingUnresolved > 0 && (
              <div className="complete-check-actions">
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    onNavigateTab('packing')
                    onClose()
                  }}
                >
                  Review packing
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => store.skipUnresolvedPacking(trip.id)}
                >
                  Skip remaining ({checks.packingUnresolved})
                </button>
              </div>
            )}
          </div>
        </li>

        <li className={`complete-check ${budgetOk ? 'ok' : 'warn'}`}>
          <Icon name={budgetOk ? 'check' : 'wallet'} size={16} />
          <div className="complete-check-body">
            <strong>Budget</strong>
            {checks.expenseCount === 0 ? (
              <p>
                No expenses logged. Add what you spent so the summary has a real budget
                breakdown.
              </p>
            ) : (
              <p>
                {checks.expenseCount} expense
                {checks.expenseCount !== 1 ? 's' : ''} logged — ready for the summary.
              </p>
            )}

            {checks.expenseCount === 0 && (
              <>
                <div className="complete-check-actions">
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => {
                      onNavigateTab('expenses')
                      onClose()
                    }}
                  >
                    Log expenses
                  </button>
                </div>
                <label className="complete-confirm">
                  <input
                    type="checkbox"
                    checked={noExpensesConfirm}
                    onChange={(e) => setNoExpensesConfirm(e.target.checked)}
                  />
                  I have nothing to log for this trip
                </label>
              </>
            )}
          </div>
        </li>
      </ul>

      {!canComplete && (
        <p className="complete-hint">
          Finish the items above (or confirm the exceptions) to complete this trip.
        </p>
      )}
    </Dialog>
  )
}
