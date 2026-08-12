import { useMemo, useState, type FormEvent } from 'react'
import { Icon } from './Icon'
import { EmptyState } from './EmptyState'
import type { ToastFn } from './Toast'
import type { MeridianData, Trip } from '../types'
import type { MeridianStore } from '../hooks/useMeridian'

interface ChecklistTabProps {
  trip: Trip
  data: MeridianData
  store: MeridianStore
  onToast: ToastFn
}

export function ChecklistTab({ trip, data, store, onToast }: ChecklistTabProps) {
  const [draft, setDraft] = useState('')
  const items = useMemo(
    () =>
      data.checklist
        .filter((c) => c.tripId === trip.id)
        .sort((a, b) => a.order - b.order),
    [data.checklist, trip.id],
  )

  const done = items.filter((i) => i.status === 'done').length
  const skipped = items.filter((i) => i.status === 'skip').length
  const remaining = items.length - done - skipped

  const handleAdd = (e: FormEvent) => {
    e.preventDefault()
    if (!draft.trim()) return
    store.addChecklistItem(trip.id, draft.trim())
    setDraft('')
    onToast('Checklist item added.', 'success')
  }

  if (items.length === 0) {
    return (
      <div className="check-tab">
        <EmptyState
          icon="check"
          title="Pre-trip checklist"
          description="Bookings, visas, insurance, SIMs — track everything before you leave."
          action={
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                store.seedChecklistForTrip(trip.id)
                onToast('Starter checklist added.', 'success')
              }}
            >
              <Icon name="sparkle" size={14} /> Add starter list
            </button>
          }
        />
      </div>
    )
  }

  return (
    <section className="check-tab">
      <header className="check-head">
        <div>
          <p className="exp-eyebrow">
            <Icon name="check" size={12} /> Pre-trip
          </p>
          <strong className="mono">
            {done}/{items.length}
          </strong>
          <small>
            done
            {remaining > 0 && <> · {remaining} left</>}
            {skipped > 0 && <> · {skipped} skipped</>}
          </small>
        </div>
      </header>

      <ul className="check-list">
        {items.map((item) => (
          <li key={item.id} className={`check-item status-${item.status}`}>
            <div className="check-item-main">
              <button
                type="button"
                className={`check-box ${item.status === 'done' ? 'on' : ''}`}
                onClick={() => store.toggleChecklistItem(item.id)}
                aria-label={item.status === 'done' ? 'Mark todo' : 'Mark done'}
              >
                {item.status === 'done' && <Icon name="check" size={12} />}
              </button>
              <span className="check-title">{item.title}</span>
            </div>
            <div className="check-item-actions">
              <button
                type="button"
                className={`pack-mini ${item.status === 'skip' ? 'active' : ''}`}
                title="Skip"
                onClick={() =>
                  store.updateChecklistItem(item.id, {
                    status: item.status === 'skip' ? 'todo' : 'skip',
                  })
                }
              >
                <Icon name="close" size={12} />
              </button>
              <button
                type="button"
                className="pack-mini danger"
                aria-label="Delete"
                onClick={() => {
                  store.deleteChecklistItem(item.id)
                  onToast('Removed.', 'info', {
                    label: 'Undo',
                    onClick: () => store.restoreChecklistItem(item),
                  })
                }}
              >
                <Icon name="trash" size={12} />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <form className="check-add" onSubmit={handleAdd}>
        <input
          className="input"
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a to-do…"
        />
        <button type="submit" className="btn btn-primary" disabled={!draft.trim()}>
          <Icon name="plus" size={14} /> Add
        </button>
      </form>
    </section>
  )
}
