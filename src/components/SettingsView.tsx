import { useMemo, useRef, useState, type FormEvent } from 'react'
import { Icon, type IconName } from './Icon'
import { ConfirmDialog } from './ConfirmDialog'
import { Dialog } from './Dialog'
import { COMMON_CURRENCIES, convert, formatMoney } from '../lib/currency'
import { CATEGORIES, CATEGORY_META } from '../lib/expenseCategories'
import { daysUntil, formatShortDate, todayISO } from '../lib/tripHelpers'
import {
  decryptBackupJson,
  encryptBackupJson,
  isEncryptedBackup,
  type EncryptedBackupFile,
} from '../lib/backupCrypto'
import {
  ensureNotificationPermission,
  maybeNotifyUpcomingTrips,
  notificationsSupported,
} from '../lib/notifications'
import { useInstallPrompt } from '../hooks/useInstallPrompt'
import type {
  ExpenseCategory,
  LoyaltyCategory,
  LoyaltyProgram,
  MeridianData,
  RecurringCostCategory,
  RecurringTravelCost,
  Settings,
} from '../types'
import type { MeridianStore } from '../hooks/useMeridian'

const LOYALTY_CATEGORIES: Array<{ id: LoyaltyCategory; label: string; icon: IconName }> = [
  { id: 'airline', label: 'Airline', icon: 'plane' },
  { id: 'hotel', label: 'Hotel', icon: 'building' },
  { id: 'rail', label: 'Rail', icon: 'map' },
  { id: 'car-rental', label: 'Car rental', icon: 'car' },
  { id: 'other', label: 'Other', icon: 'star' },
]

const RECURRING_CATEGORIES: Array<{ id: RecurringCostCategory; label: string; icon: IconName }> = [
  { id: 'membership', label: 'Membership', icon: 'star' },
  { id: 'subscription', label: 'Subscription', icon: 'refresh' },
  { id: 'insurance', label: 'Insurance', icon: 'shield' },
  { id: 'other', label: 'Other', icon: 'more' },
]

interface SettingsViewProps {
  data: MeridianData
  store: MeridianStore
  onToast: (text: string, tone?: 'default' | 'success' | 'danger' | 'info') => void
}

export function SettingsView({ data, store, onToast }: SettingsViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [pendingImport, setPendingImport] = useState<{ fileName: string; parsed: unknown } | null>(
    null,
  )
  const [encryptedImport, setEncryptedImport] = useState<{
    fileName: string
    payload: EncryptedBackupFile
  } | null>(null)
  const [encryptExportOpen, setEncryptExportOpen] = useState(false)
  const [wipeOpen, setWipeOpen] = useState(false)
  const [loyaltyDialog, setLoyaltyDialog] = useState<LoyaltyProgram | 'new' | null>(null)
  const [loyaltyDeleteTarget, setLoyaltyDeleteTarget] = useState<LoyaltyProgram | null>(null)
  const [recurringDialog, setRecurringDialog] = useState<RecurringTravelCost | 'new' | null>(null)
  const [recurringDeleteTarget, setRecurringDeleteTarget] = useState<RecurringTravelCost | null>(
    null,
  )
  const install = useInstallPrompt()

  const stats = {
    trips: data.trips.length,
    packing: data.packing.length,
    itinerary: data.itinerary.length,
    expenses: data.expenses.length,
    templates: data.customTemplates.length,
  }

  // Cross-trip spending — every trip's expenses can be in a different
  // currency, so this reports in one currency (the default home
  // currency) rather than trying to show a meaningless mixed-currency sum.
  const reportingCurrency = data.settings.defaultHomeCurrency

  const spendingByCategory = useMemo(() => {
    const map = new Map<ExpenseCategory, number>()
    let unconverted = 0
    for (const e of data.expenses) {
      const inHome = convert(e.amount, e.currency, reportingCurrency, data.cachedRates)
      if (inHome == null) {
        unconverted += 1
        continue
      }
      map.set(e.category, (map.get(e.category) ?? 0) + inHome)
    }
    return { map, unconverted }
  }, [data.expenses, reportingCurrency, data.cachedRates])

  const totalSpending = Array.from(spendingByCategory.map.values()).reduce((s, v) => s + v, 0)
  const maxCategorySpending = Math.max(...Array.from(spendingByCategory.map.values()), 1)

  const spendingByMonth = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of data.expenses) {
      const inHome = convert(e.amount, e.currency, reportingCurrency, data.cachedRates)
      if (inHome == null) continue
      const month = e.date.slice(0, 7)
      map.set(month, (map.get(month) ?? 0) + inHome)
    }
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 6)
  }, [data.expenses, reportingCurrency, data.cachedRates])

  const maxMonthSpending = Math.max(...spendingByMonth.map(([, v]) => v), 1)

  const sortedRecurringCosts = useMemo(
    () => [...data.recurringCosts].sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate)),
    [data.recurringCosts],
  )

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    store.updateSettings({ [key]: value })
    onToast('Preferences saved.', 'success')
  }

  const downloadJson = (obj: unknown, filename: string) => {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExport = () => {
    const blob = store.exportData()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const date = todayISO()
    a.download = `meridian-backup-${date}.json`
    a.click()
    URL.revokeObjectURL(url)
    onToast('Backup downloaded.', 'success')
  }

  /** Same data as handleExport, wrapped in AES-GCM under a passphrase the
   * user sets on the spot — see lib/backupCrypto.ts. Independent of the
   * document vault's own passphrase. */
  const handleExportEncrypted = async (passphrase: string) => {
    const blob = store.exportData()
    const json = await blob.text()
    const encrypted = await encryptBackupJson(json, passphrase)
    const date = todayISO()
    downloadJson(encrypted, `meridian-backup-${date}-encrypted.json`)
    onToast(
      'Encrypted backup downloaded. Remember the passphrase — it cannot be recovered.',
      'success',
    )
  }

  const handleImportClick = () => fileInputRef.current?.click()

  const handleFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      if (isEncryptedBackup(parsed)) {
        setEncryptedImport({ fileName: file.name, payload: parsed })
      } else {
        setPendingImport({ fileName: file.name, parsed })
      }
    } catch (err) {
      console.error(err)
      onToast('Could not read that file.', 'danger')
    }
  }

  /** Called from the passphrase dialog once an encrypted file is picked —
   * on success this hands off to the same "Import backup?" confirmation
   * plain imports go through, rather than merging immediately, so
   * decrypting successfully doesn't feel like a different, less-safe path. */
  const handleDecryptImport = async (passphrase: string): Promise<boolean> => {
    if (!encryptedImport) return false
    try {
      const json = await decryptBackupJson(encryptedImport.payload, passphrase)
      const parsed = JSON.parse(json)
      setPendingImport({ fileName: encryptedImport.fileName, parsed })
      setEncryptedImport(null)
      return true
    } catch (err) {
      console.warn('[meridian] backup decrypt failed', err)
      return false
    }
  }

  const cancelImport = () => {
    if (importing) return
    setPendingImport(null)
  }

  const confirmImport = () => {
    if (!pendingImport) return
    setImporting(true)
    try {
      const result = store.importData(pendingImport.parsed)
      if (result.ok) {
        onToast(
          `Imported ${result.added} new item${result.added !== 1 ? 's' : ''}.`,
          'success',
        )
      } else {
        onToast(result.error ?? 'Import failed.', 'danger')
      }
    } finally {
      setImporting(false)
      setPendingImport(null)
    }
  }

  const handleWipe = () => setWipeOpen(true)

  const confirmWipe = () => {
    store.wipeAll()
    setWipeOpen(false)
    onToast('Everything erased. Fresh start.', 'danger')
  }

  return (
    <section className="settings">
      <div className="view-lead">
        <p className="eyebrow">Settings</p>
        <h1>Preferences & data.</h1>
        <p>
          Everything about Meridian lives on this device. No accounts, no cloud, no
          telemetry.
        </p>
      </div>

      {/* ---------------------------------------------------- install */}
      {(install.canInstall || install.isInstalled || install.isIosDevice) && (
        <div className="settings-card">
          <header>
            <span className="settings-icon">
              <Icon name="download" size={16} />
            </span>
            <div>
              <strong>Install Meridian</strong>
              <small>
                {install.isInstalled
                  ? 'Installed on this device — launches like a native app.'
                  : 'Add to your home screen for one-tap access and full offline use.'}
              </small>
            </div>
          </header>
          {install.canInstall && (
            <div className="settings-body">
              <div className="settings-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void install.prompt()}
                >
                  <Icon name="download" size={14} /> Install as an app
                </button>
              </div>
            </div>
          )}
          {/* iOS/iPadOS Safari has no programmatic install prompt — the
              "beforeinstallprompt" event this whole feature otherwise
              relies on simply never fires there. Add to Home Screen is a
              manual Share-sheet action only, so tell people how instead of
              showing a button that would never appear for them. */}
          {!install.canInstall && !install.isInstalled && install.isIosDevice && (
            <div className="settings-body">
              <ol className="ios-install-steps">
                <li>
                  Tap the Share icon <Icon name="share" size={13} /> in Safari's toolbar
                </li>
                <li>Scroll down and choose "Add to Home Screen"</li>
                <li>Tap "Add" to confirm</li>
              </ol>
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------- appearance */}
      <div className="settings-card">
        <header>
          <span className="settings-icon">
            <Icon name="sun" size={16} />
          </span>
          <div>
            <strong>Appearance</strong>
            <small>How Meridian looks.</small>
          </div>
        </header>
        <div className="settings-body">
          <label className="settings-row">
            <span>
              <strong>Theme</strong>
              <small>Dark shows off the warm-horizon palette best.</small>
            </span>
            <div className="seg">
              <button
                type="button"
                className={data.settings.theme === 'dark' ? 'active' : ''}
                onClick={() => updateSetting('theme', 'dark')}
              >
                <Icon name="moon" size={13} /> Dark
              </button>
              <button
                type="button"
                className={data.settings.theme === 'light' ? 'active' : ''}
                onClick={() => updateSetting('theme', 'light')}
              >
                <Icon name="sun" size={13} /> Light
              </button>
            </div>
          </label>
        </div>
      </div>

      {/* ---------------------------------------------------- defaults */}
      <div className="settings-card">
        <header>
          <span className="settings-icon">
            <Icon name="globe" size={16} />
          </span>
          <div>
            <strong>Trip defaults</strong>
            <small>Applied to every new trip until you change them.</small>
          </div>
        </header>
        <div className="settings-body">
          <label className="settings-row">
            <span>
              <strong>Home currency</strong>
              <small>Used to sum expenses and show conversion targets.</small>
            </span>
            <select
              className="select settings-select"
              value={data.settings.defaultHomeCurrency}
              onChange={(e) =>
                updateSetting('defaultHomeCurrency', e.target.value.toUpperCase())
              }
            >
              {COMMON_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="settings-row">
            <span>
              <strong>Auto-lock</strong>
              <small>Vault relocks after idle minutes. Use 0 to never auto-lock.</small>
            </span>
            <input
              className="input settings-select"
              type="number"
              min={0}
              max={60}
              value={data.settings.autoLockMinutes}
              onChange={(e) =>
                updateSetting('autoLockMinutes', Math.max(0, Number(e.target.value) || 0))
              }
            />
          </label>

          <label className="settings-row">
            <span>
              <strong>Vault recovery hint</strong>
              <small>Shown on unlock. Never store the passphrase itself here.</small>
            </span>
            <input
              className="input settings-select"
              type="text"
              value={data.settings.vaultHint ?? ''}
              maxLength={80}
              placeholder="Optional hint"
              onChange={(e) => updateSetting('vaultHint', e.target.value || undefined)}
            />
          </label>
        </div>
      </div>

      {/* ---------------------------------------------------- loyalty */}
      <div className="settings-card">
        <header>
          <span className="settings-icon">
            <Icon name="starFilled" size={16} />
          </span>
          <div>
            <strong>Loyalty & rewards</strong>
            <small>Membership numbers that apply across every trip, not just one.</small>
          </div>
        </header>
        <div className="settings-body">
          {data.loyaltyPrograms.length === 0 ? (
            <p className="settings-sync-note">No programs saved yet.</p>
          ) : (
            <ul className="loyalty-list">
              {data.loyaltyPrograms.map((p) => {
                const meta =
                  LOYALTY_CATEGORIES.find((c) => c.id === p.category) ??
                  LOYALTY_CATEGORIES[LOYALTY_CATEGORIES.length - 1]
                return (
                  <li key={p.id} className="loyalty-row">
                    <span className="loyalty-row-icon">
                      <Icon name={meta.icon} size={14} />
                    </span>
                    <div className="loyalty-row-body">
                      <strong>{p.provider}</strong>
                      <span className="loyalty-row-meta">
                        <span className="mono">{p.memberNumber}</span>
                        {p.tier && <span className="chip">{p.tier}</span>}
                      </span>
                    </div>
                    <div className="loyalty-row-actions">
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon"
                        onClick={() => setLoyaltyDialog(p)}
                        aria-label={`Edit ${p.provider}`}
                      >
                        <Icon name="edit" size={13} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon"
                        onClick={() => setLoyaltyDeleteTarget(p)}
                        aria-label={`Remove ${p.provider}`}
                      >
                        <Icon name="trash" size={13} />
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          <div className="settings-actions">
            <button type="button" className="btn" onClick={() => setLoyaltyDialog('new')}>
              <Icon name="plus" size={14} /> Add program
            </button>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------- reminders */}
      <div className="settings-card">
        <header>
          <span className="settings-icon">
            <Icon name="clock" size={16} />
          </span>
          <div>
            <strong>Trip reminders</strong>
            <small>Local browser notifications — nothing leaves this device.</small>
          </div>
        </header>
        <div className="settings-body">
          <label className="settings-row">
            <span>
              <strong>Enable reminders</strong>
              <small>
                {notificationsSupported()
                  ? 'Nudge before upcoming trips.'
                  : 'Not supported in this browser.'}
              </small>
            </span>
            <div className="seg">
              <button
                type="button"
                className={!data.settings.remindersEnabled ? 'active' : ''}
                onClick={() => updateSetting('remindersEnabled', false)}
              >
                Off
              </button>
              <button
                type="button"
                className={data.settings.remindersEnabled ? 'active' : ''}
                onClick={() => {
                  void (async () => {
                    try {
                      const perm = await ensureNotificationPermission()
                      if (perm !== 'granted') {
                        onToast('Notification permission denied.', 'danger')
                        return
                      }
                      updateSetting('remindersEnabled', true)
                      const n = await maybeNotifyUpcomingTrips({
                        ...data,
                        settings: { ...data.settings, remindersEnabled: true },
                      })
                      if (n > 0) onToast(`Sent ${n} reminder${n !== 1 ? 's' : ''}.`, 'info')
                    } catch (err) {
                      console.warn('[meridian] enabling reminders failed', err)
                      onToast('Could not enable reminders. Try again.', 'danger')
                    }
                  })()
                }}
              >
                On
              </button>
            </div>
          </label>
          <label className="settings-row">
            <span>
              <strong>Days before start</strong>
              <small>Remind when a trip is this close.</small>
            </span>
            <input
              className="input settings-select"
              type="number"
              min={1}
              max={30}
              value={data.settings.remindDaysBefore}
              onChange={(e) =>
                updateSetting('remindDaysBefore', Math.max(1, Number(e.target.value) || 3))
              }
            />
          </label>
        </div>
      </div>

      {/* ---------------------------------------------------- spending */}
      <div className="settings-card">
        <header>
          <span className="settings-icon">
            <Icon name="chart" size={16} />
          </span>
          <div>
            <strong>Spending overview</strong>
            <small>Every trip's expenses, converted to {reportingCurrency} for one total.</small>
          </div>
        </header>
        <div className="settings-body">
          {data.expenses.length === 0 ? (
            <p className="settings-sync-note">No expenses logged yet across any trip.</p>
          ) : (
            <>
              <div className="spend-total">
                <span className="mono">{formatMoney(totalSpending, reportingCurrency, 0)}</span>
                <small>
                  across {data.expenses.length} expense{data.expenses.length !== 1 && 's'}
                  {spendingByCategory.unconverted > 0 && (
                    <>
                      {' '}
                      · <span style={{ color: 'var(--warning)' }}>
                        {spendingByCategory.unconverted} not converted
                      </span>
                    </>
                  )}
                </small>
              </div>

              <ul className="exp-cat-list spend-cat-list">
                {CATEGORIES.filter((c) => spendingByCategory.map.has(c)).map((cat) => {
                  const amount = spendingByCategory.map.get(cat) ?? 0
                  const pct = totalSpending > 0 ? Math.round((amount / totalSpending) * 100) : 0
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
                            width: `${(amount / maxCategorySpending) * 100}%`,
                            background: meta.color,
                          }}
                        />
                      </div>
                      <span className="exp-cat-amount mono">
                        {formatMoney(amount, reportingCurrency, 0)}
                      </span>
                      <span className="exp-cat-pct mono">{pct}%</span>
                    </li>
                  )
                })}
              </ul>

              {spendingByMonth.length > 0 && (
                <div className="spend-months">
                  <p className="spend-months-label">
                    Last {spendingByMonth.length} month{spendingByMonth.length !== 1 && 's'}
                  </p>
                  <ul className="spend-month-list">
                    {spendingByMonth.map(([month, amount]) => (
                      <li key={month}>
                        <span className="spend-month-name mono">{formatMonthLabel(month)}</span>
                        <div className="spend-month-bar" aria-hidden>
                          <div
                            className="spend-month-fill"
                            style={{ width: `${(amount / maxMonthSpending) * 100}%` }}
                          />
                        </div>
                        <span className="spend-month-amount mono">
                          {formatMoney(amount, reportingCurrency, 0)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------- recurring */}
      <div className="settings-card">
        <header>
          <span className="settings-icon">
            <Icon name="refresh" size={16} />
          </span>
          <div>
            <strong>Travel subscriptions</strong>
            <small>Lounge memberships, annual insurance, anything that recurs.</small>
          </div>
        </header>
        <div className="settings-body">
          {sortedRecurringCosts.length === 0 ? (
            <p className="settings-sync-note">Nothing tracked yet.</p>
          ) : (
            <ul className="loyalty-list">
              {sortedRecurringCosts.map((c) => {
                const meta =
                  RECURRING_CATEGORIES.find((r) => r.id === c.category) ??
                  RECURRING_CATEGORIES[RECURRING_CATEGORIES.length - 1]
                const until = daysUntil(c.nextDueDate)
                const dueLabel =
                  until < 0
                    ? `Overdue ${-until}d`
                    : until === 0
                      ? 'Due today'
                      : until <= 14
                        ? `Due in ${until}d`
                        : formatShortDate(c.nextDueDate)
                return (
                  <li key={c.id} className="loyalty-row">
                    <span className="loyalty-row-icon">
                      <Icon name={meta.icon} size={14} />
                    </span>
                    <div className="loyalty-row-body">
                      <strong>{c.name}</strong>
                      <span className="loyalty-row-meta">
                        <span className="mono">{formatMoney(c.amount, c.currency, 0)}</span>
                        <span>/{c.cadence === 'monthly' ? 'mo' : 'yr'}</span>
                        <span
                          className={`chip ${until < 0 ? 'danger' : until <= 14 ? 'warning' : ''}`}
                        >
                          {dueLabel}
                        </span>
                      </span>
                    </div>
                    <div className="loyalty-row-actions">
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon"
                        onClick={() => setRecurringDialog(c)}
                        aria-label={`Edit ${c.name}`}
                      >
                        <Icon name="edit" size={13} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon"
                        onClick={() => setRecurringDeleteTarget(c)}
                        aria-label={`Remove ${c.name}`}
                      >
                        <Icon name="trash" size={13} />
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          <div className="settings-actions">
            <button type="button" className="btn" onClick={() => setRecurringDialog('new')}>
              <Icon name="plus" size={14} /> Add subscription
            </button>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------- data */}
      <div className="settings-card">
        <header>
          <span className="settings-icon">
            <Icon name="database" size={16} />
          </span>
          <div>
            <strong>Your data</strong>
            <small>Backup, restore, or erase.</small>
          </div>
        </header>
        <div className="settings-body">
          <div className="settings-stats">
            <div>
              <span className="mono">{stats.trips}</span>
              <small>trips</small>
            </div>
            <div>
              <span className="mono">{stats.packing}</span>
              <small>packing items</small>
            </div>
            <div>
              <span className="mono">{stats.itinerary}</span>
              <small>events</small>
            </div>
            <div>
              <span className="mono">{stats.expenses}</span>
              <small>expenses</small>
            </div>
            <div>
              <span className="mono">{stats.templates}</span>
              <small>saved templates</small>
            </div>
          </div>

          <p className="settings-sync-note">
            Move between devices: export the JSON on phone A, import on phone B.
            Photos live in this browser’s IndexedDB and are not in the JSON backup.
          </p>
          <div className="settings-actions">
            <button type="button" className="btn" onClick={handleExport}>
              <Icon name="download" size={14} /> Export backup (.json)
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setEncryptExportOpen(true)}
              title="Wrap the backup in AES-GCM under a passphrase you set now"
            >
              <Icon name="lock" size={14} /> Export encrypted
            </button>
            <button
              type="button"
              className="btn"
              onClick={handleImportClick}
              disabled={importing}
            >
              <Icon name="upload" size={14} />
              {importing ? 'Importing…' : 'Import / merge backup'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(e) => void handleFileChosen(e)}
            />
            <button type="button" className="btn btn-danger" onClick={handleWipe}>
              <Icon name="trash" size={14} /> Erase everything
            </button>
          </div>
          <p className="settings-sync-note">
            <Icon name="lock" size={12} /> "Export encrypted" wraps the whole backup in AES-GCM
            under a passphrase you choose on the spot — separate from the docs vault passphrase,
            and not saved anywhere. Lose it and the file can't be decrypted.
          </p>

          <p className="settings-privacy">
            <Icon name="shield" size={13} /> Meridian never uploads your trips.
            Currency rates come from{' '}
            <a href="https://frankfurter.dev" target="_blank" rel="noopener noreferrer">
              frankfurter.dev
            </a>{' '}
            (public ECB data) and weather from{' '}
            <a
              href="https://open-meteo.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              open-meteo.com
            </a>{' '}
            (public forecast).
          </p>
        </div>
      </div>

      <p className="settings-version">
        Meridian · v{APP_VERSION} · <span className="mono">Compass</span>
      </p>

      <ConfirmDialog
        open={pendingImport != null}
        icon="upload"
        title="Import backup?"
        description={
          <>
            Import <strong>{pendingImport?.fileName}</strong>? This merges with your existing
            data — trips and items in the backup are added, existing ones updated. Nothing
            is deleted.
          </>
        }
        confirmLabel="Import & merge"
        busy={importing}
        busyLabel="Importing…"
        onConfirm={confirmImport}
        onClose={cancelImport}
      />

      {encryptExportOpen && (
        <BackupEncryptDialog
          onClose={() => setEncryptExportOpen(false)}
          onConfirm={handleExportEncrypted}
        />
      )}

      {encryptedImport && (
        <BackupDecryptDialog
          fileName={encryptedImport.fileName}
          onClose={() => setEncryptedImport(null)}
          onSubmit={handleDecryptImport}
        />
      )}

      <ConfirmDialog
        open={wipeOpen}
        tone="danger"
        icon="trash"
        title="Erase everything?"
        description={
          <>
            This deletes every trip, packing list, event, and expense on this device.{' '}
            <strong>This cannot be undone.</strong>
          </>
        }
        confirmLabel="Erase everything"
        typedPhrase="erase"
        onConfirm={confirmWipe}
        onClose={() => setWipeOpen(false)}
      />

      {loyaltyDialog && (
        <LoyaltyProgramDialog
          program={loyaltyDialog === 'new' ? null : loyaltyDialog}
          store={store}
          onToast={onToast}
          onClose={() => setLoyaltyDialog(null)}
        />
      )}

      <ConfirmDialog
        open={loyaltyDeleteTarget != null}
        tone="danger"
        icon="trash"
        title="Remove this program?"
        description={
          <>
            Remove <strong>{loyaltyDeleteTarget?.provider}</strong> from your saved loyalty
            programs?
          </>
        }
        confirmLabel="Remove"
        onConfirm={() => {
          if (loyaltyDeleteTarget) {
            store.deleteLoyaltyProgram(loyaltyDeleteTarget.id)
            onToast('Program removed.', 'info')
          }
          setLoyaltyDeleteTarget(null)
        }}
        onClose={() => setLoyaltyDeleteTarget(null)}
      />

      {recurringDialog && (
        <RecurringCostDialog
          cost={recurringDialog === 'new' ? null : recurringDialog}
          defaultCurrency={data.settings.defaultHomeCurrency}
          store={store}
          onToast={onToast}
          onClose={() => setRecurringDialog(null)}
        />
      )}

      <ConfirmDialog
        open={recurringDeleteTarget != null}
        tone="danger"
        icon="trash"
        title="Remove this subscription?"
        description={
          <>
            Remove <strong>{recurringDeleteTarget?.name}</strong> from your tracked
            subscriptions?
          </>
        }
        confirmLabel="Remove"
        onConfirm={() => {
          if (recurringDeleteTarget) {
            store.deleteRecurringCost(recurringDeleteTarget.id)
            onToast('Subscription removed.', 'info')
          }
          setRecurringDeleteTarget(null)
        }}
        onClose={() => setRecurringDeleteTarget(null)}
      />
    </section>
  )
}

function LoyaltyProgramDialog({
  program,
  store,
  onToast,
  onClose,
}: {
  program: LoyaltyProgram | null
  store: MeridianStore
  onToast: SettingsViewProps['onToast']
  onClose: () => void
}) {
  const [provider, setProvider] = useState(program?.provider ?? '')
  const [category, setCategory] = useState<LoyaltyCategory>(program?.category ?? 'airline')
  const [memberNumber, setMemberNumber] = useState(program?.memberNumber ?? '')
  const [tier, setTier] = useState(program?.tier ?? '')
  const [notes, setNotes] = useState(program?.notes ?? '')

  const canSave = provider.trim().length > 0 && memberNumber.trim().length > 0

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!canSave) return
    const input = {
      provider: provider.trim(),
      category,
      memberNumber: memberNumber.trim(),
      tier: tier.trim() || undefined,
      notes: notes.trim() || undefined,
    }
    if (program) {
      store.updateLoyaltyProgram(program.id, input)
      onToast('Program updated.', 'success')
    } else {
      store.addLoyaltyProgram(input)
      onToast('Loyalty program added.', 'success')
    }
    onClose()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={program ? 'Edit loyalty program' : 'Add loyalty program'}
      size="sm"
      footer={
        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="loyalty-form" className="btn btn-primary" disabled={!canSave}>
            {program ? 'Save changes' : 'Add program'}
          </button>
        </div>
      }
    >
      <form id="loyalty-form" onSubmit={handleSubmit} className="trip-form">
        <div className="label">
          <span>Type</span>
          <div className="type-chips type-chips-compact">
            {LOYALTY_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`type-chip ${category === c.id ? 'active' : ''}`}
                onClick={() => setCategory(c.id)}
              >
                <Icon name={c.icon} size={13} />
                <span className="type-chip-label">{c.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="row-2">
          <label className="label">
            <span>Provider</span>
            <input
              className="input"
              type="text"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              placeholder="e.g. United MileagePlus"
              autoFocus
              required
            />
          </label>
          <label className="label">
            <span>Membership tier (optional)</span>
            <input
              className="input"
              type="text"
              value={tier}
              onChange={(e) => setTier(e.target.value)}
              placeholder="e.g. Gold"
            />
          </label>
        </div>
        <label className="label">
          <span>Member number</span>
          <input
            className="input mono"
            type="text"
            value={memberNumber}
            onChange={(e) => setMemberNumber(e.target.value)}
            required
          />
        </label>
        <label className="label">
          <span>Notes (optional)</span>
          <textarea
            className="input textarea"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </label>
      </form>
    </Dialog>
  )
}

function RecurringCostDialog({
  cost,
  defaultCurrency,
  store,
  onToast,
  onClose,
}: {
  cost: RecurringTravelCost | null
  defaultCurrency: string
  store: MeridianStore
  onToast: SettingsViewProps['onToast']
  onClose: () => void
}) {
  const [name, setName] = useState(cost?.name ?? '')
  const [amount, setAmount] = useState(cost ? String(cost.amount) : '')
  const [currency, setCurrency] = useState(cost?.currency ?? defaultCurrency)
  const [cadence, setCadence] = useState<RecurringTravelCost['cadence']>(cost?.cadence ?? 'yearly')
  const [category, setCategory] = useState<RecurringCostCategory>(cost?.category ?? 'membership')
  const [nextDueDate, setNextDueDate] = useState(cost?.nextDueDate ?? '')
  const [notes, setNotes] = useState(cost?.notes ?? '')

  const canSave = name.trim().length > 0 && Number(amount) > 0 && nextDueDate.length > 0

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!canSave) return
    const input = {
      name: name.trim(),
      amount: Number(amount),
      currency,
      cadence,
      category,
      nextDueDate,
      notes: notes.trim() || undefined,
    }
    if (cost) {
      store.updateRecurringCost(cost.id, input)
      onToast('Subscription updated.', 'success')
    } else {
      store.addRecurringCost(input)
      onToast('Subscription added.', 'success')
    }
    onClose()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={cost ? 'Edit subscription' : 'Add subscription'}
      size="sm"
      footer={
        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="recurring-form"
            className="btn btn-primary"
            disabled={!canSave}
          >
            {cost ? 'Save changes' : 'Add subscription'}
          </button>
        </div>
      }
    >
      <form id="recurring-form" onSubmit={handleSubmit} className="trip-form">
        <div className="label">
          <span>Type</span>
          <div className="type-chips type-chips-compact">
            {RECURRING_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`type-chip ${category === c.id ? 'active' : ''}`}
                onClick={() => setCategory(c.id)}
              >
                <Icon name={c.icon} size={13} />
                <span className="type-chip-label">{c.label}</span>
              </button>
            ))}
          </div>
        </div>
        <label className="label">
          <span>Name</span>
          <input
            className="input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Priority Pass, Global Entry"
            autoFocus
            required
          />
        </label>
        <div className="row-2">
          <label className="label">
            <span>Amount</span>
            <input
              className="input mono"
              type="number"
              min={0}
              step={0.01}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
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
        <div className="row-2">
          <label className="label">
            <span>Billed</span>
            <div className="seg">
              <button
                type="button"
                className={cadence === 'monthly' ? 'active' : ''}
                onClick={() => setCadence('monthly')}
              >
                Monthly
              </button>
              <button
                type="button"
                className={cadence === 'yearly' ? 'active' : ''}
                onClick={() => setCadence('yearly')}
              >
                Yearly
              </button>
            </div>
          </label>
          <label className="label">
            <span>Next due date</span>
            <input
              className="input"
              type="date"
              value={nextDueDate}
              onChange={(e) => setNextDueDate(e.target.value)}
              required
            />
          </label>
        </div>
        <label className="label">
          <span>Notes (optional)</span>
          <textarea
            className="input textarea"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </label>
      </form>
    </Dialog>
  )
}

// -------------------------------------------------------------------

/** Sets a one-time passphrase to encrypt a fresh backup export. Not tied
 * to (and doesn't need) the docs vault — someone with no documents saved
 * can still encrypt their trip/expense data before it leaves the device. */
function BackupEncryptDialog({
  onClose,
  onConfirm,
}: {
  onClose: () => void
  onConfirm: (passphrase: string) => Promise<void>
}) {
  const [passphrase, setPassphrase] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = passphrase.length >= 4 && passphrase === confirm

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    try {
      await onConfirm(passphrase)
      onClose()
    } catch (err) {
      console.warn('[meridian] backup encrypt failed', err)
      setError('Could not encrypt the backup. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Encrypt this backup"
      subtitle="Set a passphrase now — it isn't saved anywhere, so write it down."
      size="sm"
      footer={
        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="submit"
            form="encrypt-backup-form"
            className="btn btn-primary"
            disabled={!canSubmit || busy}
          >
            <Icon name="lock" size={14} />
            {busy ? 'Encrypting…' : 'Encrypt & download'}
          </button>
        </div>
      }
    >
      <form
        id="encrypt-backup-form"
        onSubmit={(e) => void handleSubmit(e)}
        className="trip-form"
      >
        <label className="label">
          <span>Passphrase</span>
          <input
            className="input"
            type="password"
            value={passphrase}
            onChange={(e) => {
              setPassphrase(e.target.value)
              setError(null)
            }}
            placeholder="At least 4 characters"
            autoFocus
            autoComplete="new-password"
          />
        </label>
        <label className="label">
          <span>Confirm passphrase</span>
          <input
            className="input"
            type="password"
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value)
              setError(null)
            }}
            placeholder="Type it again"
            autoComplete="new-password"
          />
        </label>
        {error && <p className="docs-error">{error}</p>}
        <p className="docs-lock-hint">
          There is no reset — if you forget this passphrase, this particular backup file
          can't be decrypted. Your live data on this device is unaffected either way.
        </p>
      </form>
    </Dialog>
  )
}

/** Prompts for the passphrase used to encrypt a backup file picked for
 * import, then hands the decrypted, parsed JSON back to the caller. */
function BackupDecryptDialog({
  fileName,
  onClose,
  onSubmit,
}: {
  fileName: string
  onClose: () => void
  onSubmit: (passphrase: string) => Promise<boolean>
}) {
  const [passphrase, setPassphrase] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!passphrase) return
    setBusy(true)
    setError(null)
    const ok = await onSubmit(passphrase)
    setBusy(false)
    if (!ok) setError('Wrong passphrase or corrupted file.')
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Encrypted backup"
      subtitle={`Enter the passphrase used to encrypt "${fileName}".`}
      size="sm"
      footer={
        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="submit"
            form="decrypt-backup-form"
            className="btn btn-primary"
            disabled={busy || !passphrase}
          >
            <Icon name="unlock" size={14} />
            {busy ? 'Decrypting…' : 'Decrypt & continue'}
          </button>
        </div>
      }
    >
      <form
        id="decrypt-backup-form"
        onSubmit={(e) => void handleSubmit(e)}
        className="trip-form"
      >
        <label className="label">
          <span>Passphrase</span>
          <input
            className="input"
            type="password"
            value={passphrase}
            onChange={(e) => {
              setPassphrase(e.target.value)
              setError(null)
            }}
            autoFocus
            autoComplete="current-password"
          />
        </label>
        {error && <p className="docs-error">{error}</p>}
      </form>
    </Dialog>
  )
}

/** "2026-08" -> "Aug 2026". */
function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number)
  if (!year || !month) return monthKey
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: 'short',
    year: 'numeric',
  })
}

const APP_VERSION = '1.0.0'
