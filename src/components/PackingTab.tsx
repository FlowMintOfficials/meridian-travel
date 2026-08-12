import { memo, useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Icon, type IconName } from './Icon'
import { EmptyState } from './EmptyState'
import { Dialog } from './Dialog'
import { ConfirmDialog } from './ConfirmDialog'
import type {
  MeridianData,
  PackingCategory,
  PackingItem,
  PackingTemplate,
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

  // Stable (never-changing) id-based callback so memoized PackItemRow rows
  // don't all get a fresh prop — and re-render — on every PackingTab
  // render. store.updatePackingItem itself never changes identity either.
  const handleQuantity = useCallback(
    (id: string, q: number) => store.updatePackingItem(id, { quantity: q }),
    [store],
  )

  const [showAdd, setShowAdd] = useState(false)
  const [addName, setAddName] = useState('')
  const [addCategory, setAddCategory] = useState<PackingCategory>('other')
  const [addQuantity, setAddQuantity] = useState(1)
  const [collapseChecked, setCollapseChecked] = useState(false)
  const [showTemplateDialog, setShowTemplateDialog] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const [confirmAction, setConfirmAction] = useState<'reset' | 'clear' | null>(null)

  // One pass instead of five separate `.filter()` scans — this re-renders
  // on every keystroke in the Add-item/template dialogs below (their state
  // lives on this same component), so re-scanning `items` repeatedly on
  // each one adds up on a long packing list.
  const { total, packed, skipped, remaining, essentialsTotal, essentialsPacked } = useMemo(() => {
    let packedN = 0
    let skippedN = 0
    let essentialsTotalN = 0
    let essentialsPackedN = 0
    for (const i of items) {
      if (i.status === 'packed') packedN++
      else if (i.status === 'skip') skippedN++
      if (i.essential) {
        essentialsTotalN++
        if (i.status === 'packed') essentialsPackedN++
      }
    }
    return {
      total: items.length,
      packed: packedN,
      skipped: skippedN,
      remaining: items.length - packedN - skippedN,
      essentialsTotal: essentialsTotalN,
      essentialsPacked: essentialsPackedN,
    }
  }, [items])
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
    const toAdd = relevant.filter((it) => !existingNames.has(it.name.toLowerCase()))
    if (toAdd.length > 0) store.addPackingItems(trip.id, toAdd)
    onToast(
      toAdd.length > 0
        ? `Added ${toAdd.length} suggested item${toAdd.length !== 1 ? 's' : ''} from the ${template.name} template.`
        : 'Your list already covers the built-in template.',
      toAdd.length > 0 ? 'success' : 'info',
    )
  }

  const saveAsTemplate = () => {
    if (!templateName.trim()) return
    store.saveAsTemplate(trip.id, templateName.trim())
    onToast(`Template "${templateName.trim()}" saved.`, 'success')
    setTemplateName('')
    setShowTemplateDialog(false)
  }

  const applyTemplate = (tpl: PackingTemplate) => {
    const existingNames = new Set(items.map((i) => i.name.toLowerCase()))
    const toAdd = tpl.items.filter((it) => !existingNames.has(it.name.toLowerCase()))
    if (toAdd.length > 0) store.addPackingItems(trip.id, toAdd)
    setShowTemplatePicker(false)
    onToast(
      toAdd.length > 0
        ? `Added ${toAdd.length} item${toAdd.length !== 1 ? 's' : ''} from "${tpl.name}".`
        : `Your list already covers "${tpl.name}".`,
      toAdd.length > 0 ? 'success' : 'info',
    )
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
              {essentialsTotal > 0 && (
                <>
                  <Icon name="star" size={11} /> {essentialsPacked}/{essentialsTotal} essentials
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
            <>
              <button type="button" className="btn btn-primary" onClick={seedFromTemplate}>
                <Icon name="sparkle" size={14} /> Smart start
              </button>
              <button type="button" className="btn" onClick={() => setShowTemplatePicker(true)}>
                <Icon name="download" size={14} /> Use saved template
              </button>
            </>
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
                  <button type="button" onClick={() => setShowTemplatePicker(true)}>
                    <Icon name="download" size={13} /> Apply saved template
                  </button>
                  <button type="button" onClick={() => setShowTemplateDialog(true)}>
                    <Icon name="upload" size={13} /> Save as template
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
                      onToggle={store.togglePackingStatus}
                      onSkip={store.toggleSkipPacking}
                      onEssential={store.toggleEssentialPacking}
                      onQuantity={handleQuantity}
                      onDelete={store.deletePackingItem}
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

      {showTemplatePicker && (
        <Dialog
          open
          onClose={() => setShowTemplatePicker(false)}
          title="Apply a saved template"
          subtitle="Adds items you don’t already have — nothing already on the list is touched."
          size="sm"
          footer={
            <div className="dialog-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowTemplatePicker(false)}
              >
                Close
              </button>
            </div>
          }
        >
          {data.customTemplates.length === 0 ? (
            <EmptyState
              icon="download"
              title="No saved templates yet"
              description="Pack a trip the way you like, then use ⋯ → Save as template to reuse it here next time."
            />
          ) : (
            <ul className="template-picker-list">
              {data.customTemplates.map((tpl) => (
                <li key={tpl.id}>
                  <button
                    type="button"
                    className="template-picker-item"
                    onClick={() => applyTemplate(tpl)}
                  >
                    <span className="template-picker-item-body">
                      <strong>{tpl.name}</strong>
                      <small>
                        {tpl.items.length} item{tpl.items.length !== 1 ? 's' : ''}
                      </small>
                    </span>
                    <Icon name="arrowRight" size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
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
  onToggle: (id: string) => void
  onSkip: (id: string) => void
  onEssential: (id: string) => void
  onQuantity: (id: string, q: number) => void
  onDelete: (id: string) => void
}

/** memo()'d: every prop above is now a stable, id-taking callback (see
 * call site), so a row only re-renders when its own `item` actually
 * changes — not on every keystroke elsewhere in this tab (Add-item
 * dialog, template name, etc.), which matters once a list has 100+ items
 * across categories. */
const PackItemRow = memo(function PackItemRow({
  item,
  onToggle,
  onSkip,
  onEssential,
  onQuantity,
  onDelete,
}: PackItemRowProps) {
  // Local draft so each digit typed doesn't immediately write through to
  // the store (and re-persist the whole dataset) — committed on blur/Enter.
  const [qtyDraft, setQtyDraft] = useState(String(item.quantity))

  useEffect(() => {
    setQtyDraft(String(item.quantity))
  }, [item.quantity])

  const commitQty = () => {
    const q = Math.max(1, Math.min(99, Number(qtyDraft) || 1))
    setQtyDraft(String(q))
    if (q !== item.quantity) onQuantity(item.id, q)
  }

  return (
    <li className={`pack-item status-${item.status} ${item.essential ? 'is-essential' : ''}`}>
      <div className="pack-item-main">
        <button
          type="button"
          className="pack-check"
          onClick={() => onToggle(item.id)}
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
            value={qtyDraft}
            min={1}
            max={99}
            onChange={(e) => setQtyDraft(e.target.value)}
            onBlur={commitQty}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
            }}
            aria-label="Quantity"
          />
        )}

        <div className="pack-row-actions">
          <button
            type="button"
            className={`pack-mini ${item.essential ? 'active' : ''}`}
            onClick={() => onEssential(item.id)}
            title={item.essential ? 'Remove from essentials' : 'Mark as essential'}
          >
            <Icon name={item.essential ? 'starFilled' : 'star'} size={13} />
          </button>
          <button
            type="button"
            className={`pack-mini ${item.status === 'skip' ? 'active' : ''}`}
            onClick={() => onSkip(item.id)}
            title={item.status === 'skip' ? 'Un-skip' : 'Skip this trip'}
          >
            <Icon name="close" size={13} />
          </button>
          <button
            type="button"
            className="pack-mini danger"
            onClick={() => onDelete(item.id)}
            title="Delete item"
          >
            <Icon name="trash" size={13} />
          </button>
        </div>
      </div>
    </li>
  )
})

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
