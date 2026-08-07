import { useRef, useState } from 'react'
import { Icon } from './Icon'
import { ConfirmDialog } from './ConfirmDialog'
import { COMMON_CURRENCIES } from '../lib/currency'
import {
  ensureNotificationPermission,
  maybeNotifyUpcomingTrips,
  notificationsSupported,
} from '../lib/notifications'
import { useInstallPrompt } from '../hooks/useInstallPrompt'
import type { MeridianData, Settings } from '../types'
import type { MeridianStore } from '../hooks/useMeridian'

interface SettingsViewProps {
  data: MeridianData
  store: MeridianStore
  onToast: (text: string, tone?: 'default' | 'success' | 'danger' | 'info') => void
}

export function SettingsView({ data, store, onToast }: SettingsViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [pendingImport, setPendingImport] = useState<File | null>(null)
  const [wipeOpen, setWipeOpen] = useState(false)
  const install = useInstallPrompt()

  const stats = {
    trips: data.trips.length,
    packing: data.packing.length,
    itinerary: data.itinerary.length,
    expenses: data.expenses.length,
    templates: data.customTemplates.length,
  }

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    store.updateSettings({ [key]: value })
    onToast('Preferences saved.', 'success')
  }

  const handleExport = () => {
    const blob = store.exportData()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const date = new Date().toISOString().slice(0, 10)
    a.download = `meridian-backup-${date}.json`
    a.click()
    URL.revokeObjectURL(url)
    onToast('Backup downloaded.', 'success')
  }

  const handleImportClick = () => fileInputRef.current?.click()

  const handleFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPendingImport(file)
  }

  const cancelImport = () => {
    if (importing) return
    setPendingImport(null)
  }

  const confirmImport = async () => {
    const file = pendingImport
    if (!file) return
    setImporting(true)
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      const result = store.importData(parsed)
      if (result.ok) {
        onToast(
          `Imported ${result.added} new item${result.added !== 1 ? 's' : ''}.`,
          'success',
        )
      } else {
        onToast(result.error ?? 'Import failed.', 'danger')
      }
    } catch (err) {
      console.error(err)
      onToast('Could not read that file.', 'danger')
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
      {(install.canInstall || install.isInstalled) && (
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
              onChange={handleFileChosen}
            />
            <button type="button" className="btn btn-danger" onClick={handleWipe}>
              <Icon name="trash" size={14} /> Erase everything
            </button>
          </div>

          <p className="settings-privacy">
            <Icon name="shield" size={13} /> Meridian never uploads your trips.
            Currency rates come from{' '}
            <a href="https://www.frankfurter.app" target="_blank" rel="noopener noreferrer">
              frankfurter.app
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
            Import <strong>{pendingImport?.name}</strong>? This merges with your existing
            data — trips and items in the backup are added, existing ones updated. Nothing
            is deleted.
          </>
        }
        confirmLabel="Import & merge"
        busy={importing}
        busyLabel="Importing…"
        onConfirm={() => void confirmImport()}
        onClose={cancelImport}
      />

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
    </section>
  )
}

const APP_VERSION = '1.0.0'
