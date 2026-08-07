import { useMemo, useState, type FormEvent } from 'react'
import { Icon, type IconName } from './Icon'
import { EmptyState } from './EmptyState'
import { Dialog } from './Dialog'
import { ConfirmDialog } from './ConfirmDialog'
import type {
  MeridianData,
  PackingCategory,
  PackingItem,
  Trip,
  WeatherTag,
} from '../types'
import type { MeridianStore } from '../hooks/useMeridian'
import { filterByWeather, templateForType } from '../lib/packingTemplates'
import { tagsFromForecast } from '../lib/weather'

interface PackingTabProps {
  trip: Trip
  data: MeridianData
  store: MeridianStore
  onToast: (text: string, tone?: 'default' | 'success' | 'danger' | 'info') => void
}

const CATEGORY_META: Record<PackingCategory, { label: string; icon: IconName; order: number }> = {
  essentials: { label: 'Essentials', icon: 'star', order: 0 },
  documents: { label: 'Documents', icon: 'fileText', order: 1 },
  clothing: { label: 'Clothing', icon: 'shirt', order: 2 },
  toiletries: { label: 'Toiletries', icon: 'droplet', order: 3 },
  electronics: { label: 'Electronics', icon: 'creditCard', order: 4 },
  health: { label: 'Health', icon: 'shield', order: 5 },
  gear: { label: 'Gear', icon: 'suitcase', order: 6 },
  kids: { label: 'Kids', icon: 'users', order: 7 },
  other: { label: 'Other', icon: 'more', order: 99 },
}

const CATEGORIES: PackingCategory[] = (
  Object.keys(CATEGORY_META) as PackingCategory[]
).sort((a, b) => CATEGORY_META[a].order - CATEGORY_META[b].order)

export function PackingTab({ trip, data, store, onToast }: PackingTabProps) {
  const items = useMemo(
    () => data.packing.filter((p) => p.tripId === trip.id),
    [data.packing, trip.id],
  )

  const grouped = useMemo(() => groupByCategory(items), [items])

  const [showAdd, setShowAdd] = useState(false)
  const [addName, setAddName] = useState('')
  const [addCategory, setAddCategory] = useState<PackingCategory>('other')
  const [addQuantity, setAddQuantity] = useState(1)
  const [collapseChecked, setCollapseChecked] = useState(false)
  const [showTemplateDialog, setShowTemplateDialog] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [confirmAction, setConfirmAction] = useState<'reset' | 'clear' | null>(null)

  const total = items.length
  const packed = items.filter((i) => i.status === 'packed').length
  const skipped = items.filter((i) => i.status === 'skip').length
  const remaining = total - packed - skipped
  const essentials = items.filter((i) => i.essential)
  const essentialsPacked = essentials.filter((i) => i.status === 'packed').length
  const percent = total === 0 ? 0 : Math.round((packed / total) * 100)

  const handleAdd = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const name = addName.trim()
    if (!name) return
    store.addPackingItem(trip.id, name, addCategory, Math.max(1, addQuantity))
    onToast(`Added "${name}"`, 'success')
    setAddName('')
    setAddQuantity(1)
    setShowAdd(false)
  }

  const seedFromTemplate = () => {
    // Re-seed using current weather tags if we have them.
    const dest = trip.destinations[0]
    const forecast =
      dest?.latitude != null && dest?.longitude != null
        ? data.cachedWeather.find(
            (w) =>
              w.latitude.toFixed(2) === dest.latitude!.toFixed(2) &&
              w.longitude.toFixed(2) === dest.longitude!.toFixed(2),
          )
        : undefined
    const tags: WeatherTag[] = tagsFromForecast(forecast)
    const template = templateForType(trip.type)
    const relevant = filterByWeather(template, tags)
    // Merge — skip items whose names already exist.
    const existingNames = new Set(items.map((i) => i.name.toLowerCase()))
    let added = 0
    for (const it of relevant) {
      if (existingNames.has(it.name.toLowerCase())) continue
      store.addPackingItem(trip.id, it.name, it.category, it.quantity)
      added += 1
    }
    onToast(
      added > 0
        ? `Added ${added} suggested item${added !== 1 ? 's' : ''} from the ${template.name} template.`
        : 'Your list already covers the built-in template.',
      added > 0 ? 'success' : 'info',
    )
  }

  const saveAsTemplate = () => {
    if (!templateName.trim()) return
    store.saveAsTemplate(trip.id, templateName.trim())
    onToast(`Template "${templateName.trim()}" saved.`, 'success')
    setTemplateName('')
    setShowTemplateDialog(false)
  }

  const confirmReset = () => {
    store.resetPacking(trip.id)
    setConfirmAction(null)
    onToast('Packing list reset.', 'info')
  }

  const confirmClear = () => {
    store.clearPacking(trip.id)
    setConfirmAction(null)
    onToast('Packing list cleared.', 'danger')
  }

  return (
    <section className="pack">
      <header className="pack-head">
        <div className="pack-progress-wrap">
          <div className="pack-progress-num">
            <span className="mono">{packed}</span>
            <span className="pack-progress-total">/ {total}</span>
          </div>
          <div className="pack-progress-copy">
            <strong>
              {total === 0
                ? 'Nothing on your list yet'
                : percent === 100
                  ? 'Fully packed. You are ready.'
                  : `${percent}% packed`}
            </strong>
            <small>
              {essentials.length > 0 && (
                <>
                  <Icon name="star" size={11} /> {essentialsPacked}/{essentials.length} essentials
                  <span className="pack-dot">·</span>
                </>
              )}
              {remaining} to pack
              {skipped > 0 && (
                <>
                  <span className="pack-dot">·</span>
                  {skipped} skipped
                </>
              )}
            </small>
          </div>
        </div>

        <div className="pack-actions">
          {total === 0 ? (
            <button type="button" className="btn btn-primary" onClick={seedFromTemplate}>
              <Icon name="sparkle" size={14} /> Smart start
            </button>
          ) : (
            <>
              <label className="pack-toggle">
                <input
                  type="checkbox"
                  checked={collapseChecked}
                  onChange={(e) => setCollapseChecked(e.target.checked)}
                />
                <span>Hide packed</span>
              </label>
              <button type="button" className="btn" onClick={() => setShowAdd(true)}>
                <Icon name="plus" size={14} /> Add item
              </button>
              <details className="pack-menu">
                <summary className="btn btn-ghost">
                  <Icon name="more" size={14} />
                </summary>
                <div className="pack-menu-panel">
                  <button type="button" onClick={seedFromTemplate}>
                    <Icon name="sparkle" size={13} /> Add smart suggestions
                  </button>
                  <button type="button" onClick={() => setShowTemplateDialog(true)}>
                    <Icon name="download" size={13} /> Save as template
                  </button>
                  <button type="button" onClick={() => setConfirmAction('reset')}>
                    <Icon name="refresh" size={13} /> Reset checkboxes
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => setConfirmAction('clear')}
                  >
                    <Icon name="trash" size={13} /> Clear all items
                  </button>
                </div>
              </details>
            </>
          )}
        </div>
      </header>

      <div className="pack-progress-bar" aria-hidden>
        <div className="pack-progress-fill" style={{ width: `${percent}%` }} />
      </div>

      {total === 0 ? (
        <EmptyState
          icon="suitcase"
          title="Nothing packed yet"
          description="Use Smart start to get a curated list based on your trip type and destination weather — or add items one by one."
          action={
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-primary" onClick={seedFromTemplate}>
                <Icon name="sparkle" size={14} /> Smart start
              </button>
              <button type="button" className="btn" onClick={() => setShowAdd(true)}>
                <Icon name="plus" size={14} /> Add one item
              </button>
            </div>
          }
        />
      ) : (
        <div className="pack-list">
          {CATEGORIES.map((cat) => {
            const bucket = grouped.get(cat)
            if (!bucket || bucket.length === 0) return null
            const visible = collapseChecked
              ? bucket.filter((i) => i.status !== 'packed' && i.status !== 'skip')
              : bucket
            if (visible.length === 0) return null
            const meta = CATEGORY_META[cat]
            const packedInCat = bucket.filter((i) => i.status === 'packed').length
            return (
              <div key={cat} className="pack-group">
                <header className="pack-group-head">
                  <span className="pack-group-title">
                    <Icon name={meta.icon} size={13} /> {meta.label}
                  </span>
                  <span className="pack-group-count mono">
                    {packedInCat}/{bucket.length}
                  </span>
                </header>
                <ul className="pack-items">
                  {visible.map((item) => (
                    <PackItemRow
                      key={item.id}
                      item={item}
                      onToggle={() => store.togglePackingStatus(item.id)}
                      onSkip={() =>
                        store.updatePackingItem(item.id, {
                          status: item.status === 'skip' ? 'todo' : 'skip',
                        })
                      }
                      onEssential={() =>
                        store.updatePackingItem(item.id, { essential: !item.essential })
                      }
                      onQuantity={(q) => store.updatePackingItem(item.id, { quantity: q })}
                      onDelete={() => store.deletePackingItem(item.id)}
                    />
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}

      {showAdd && (
        <Dialog
          open
          onClose={() => setShowAdd(false)}
          title="Add packing item"
          size="sm"
          footer={
            <div className="dialog-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowAdd(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="add-pack-form"
                className="btn btn-primary"
                disabled={!addName.trim()}
              >
                Add
              </button>
            </div>
          }
        >
          <form id="add-pack-form" onSubmit={handleAdd} className="trip-form">
            <label className="label">
              <span>Item name</span>
              <input
                className="input"
                type="text"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="e.g. Snorkel mask"
                autoFocus
                required
              />
            </label>
            <div className="row-2">
              <label className="label">
                <span>Category</span>
                <select
                  className="select"
                  value={addCategory}
                  onChange={(e) => setAddCategory(e.target.value as PackingCategory)}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_META[c].label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="label">
                <span>Quantity</span>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={99}
                  value={addQuantity}
                  onChange={(e) => setAddQuantity(Number(e.target.value))}
                />
              </label>
            </div>
          </form>
        </Dialog>
      )}

      {showTemplateDialog && (
        <Dialog
          open
          onClose={() => setShowTemplateDialog(false)}
          title="Save as template"
          subtitle="Reuse this list on your next trip of the same type."
          size="sm"
          footer={
            <div className="dialog-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowTemplateDialog(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={saveAsTemplate}
                disabled={!templateName.trim()}
              >
                Save
              </button>
            </div>
          }
        >
          <label className="label">
            <span>Template name</span>
            <input
              className="input"
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder={`${trip.name} — packing list`}
              autoFocus
            />
          </label>
        </Dialog>
      )}

      <ConfirmDialog
        open={confirmAction === 'reset'}
        icon="refresh"
        title="Reset checkboxes?"
        description="Every item goes back to “to pack.” Nothing is removed from the list."
        confirmLabel="Reset"
        onConfirm={confirmReset}
        onClose={() => setConfirmAction(null)}
      />

      <ConfirmDialog
        open={confirmAction === 'clear'}
        tone="danger"
        icon="trash"
        title="Clear the packing list?"
        description={
          <>
            Delete every item on this packing list. <strong>This cannot be undone.</strong>
          </>
        }
        confirmLabel="Clear all items"
        onConfirm={confirmClear}
        onClose={() => setConfirmAction(null)}
      />
    </section>
  )
}

// -------------------------------------------------------------------

interface PackItemRowProps {
  item: PackingItem
  onToggle: () => void
  onSkip: () => void
  onEssential: () => void
  onQuantity: (q: number) => void
  onDelete: () => void
}

function PackItemRow({
  item,
  onToggle,
  onSkip,
  onEssential,
  onQuantity,
  onDelete,
}: PackItemRowProps) {
  return (
    <li className={`pack-item status-${item.status} ${item.essential ? 'is-essential' : ''}`}>
      <div className="pack-item-main">
        <button
          type="button"
          className="pack-check"
          onClick={onToggle}
          aria-label={item.status === 'packed' ? 'Unpack' : 'Mark packed'}
        >
          {item.status === 'packed' && <Icon name="check" size={14} />}
        </button>

        <span className="pack-name">
          {item.name}
          {item.essential && (
            <Icon name="starFilled" size={11} className="pack-essential-mark" />
          )}
        </span>
      </div>

      <div className="pack-item-footer">
        {item.quantity > 1 && (
          <input
            type="number"
            className="pack-quantity mono"
            value={item.quantity}
            min={1}
            max={99}
            onChange={(e) => onQuantity(Math.max(1, Number(e.target.value) || 1))}
            aria-label="Quantity"
          />
        )}

        <div className="pack-row-actions">
          <button
            type="button"
            className={`pack-mini ${item.essential ? 'active' : ''}`}
            onClick={onEssential}
            title={item.essential ? 'Remove from essentials' : 'Mark as essential'}
          >
            <Icon name={item.essential ? 'starFilled' : 'star'} size={13} />
          </button>
          <button
            type="button"
            className={`pack-mini ${item.status === 'skip' ? 'active' : ''}`}
            onClick={onSkip}
            title={item.status === 'skip' ? 'Un-skip' : 'Skip this trip'}
          >
            <Icon name="close" size={13} />
          </button>
          <button
            type="button"
            className="pack-mini danger"
            onClick={onDelete}
            title="Delete item"
          >
            <Icon name="trash" size={13} />
          </button>
        </div>
      </div>
    </li>
  )
}

function groupByCategory(items: PackingItem[]): Map<PackingCategory, PackingItem[]> {
  const map = new Map<PackingCategory, PackingItem[]>()
  for (const it of items) {
    const arr = map.get(it.category) ?? []
    arr.push(it)
    map.set(it.category, arr)
  }
  for (const [, arr] of map) {
    arr.sort((a, b) => {
      // Essentials first, then unpacked, then packed, then skipped.
      const score = (i: PackingItem) =>
        (i.essential ? 0 : 10) +
        (i.status === 'todo' ? 0 : i.status === 'packed' ? 1 : 2)
      return score(a) - score(b) || a.order - b.order
    })
  }
  return map
}
