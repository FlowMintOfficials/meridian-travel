import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMeridian } from './hooks/useMeridian'
import { useOnlineStatus, useServiceWorkerUpdate } from './hooks/useInstallPrompt'
import { SideNav } from './components/SideNav'
import { AppHeader } from './components/AppHeader'
import { TripsView } from './components/TripsView'
import { TripDetail } from './components/TripDetail'
import { SettingsView } from './components/SettingsView'
import { HelpView } from './components/HelpView'
import { CreateTripDialog } from './components/CreateTripDialog'
import { ImportSharedTripDialog } from './components/ImportSharedTripDialog'
import { Toast, type ToastFn, type ToastMessage } from './components/Toast'
import { EmptyState } from './components/EmptyState'
import { Icon } from './components/Icon'
import { maybeNotifyUpcomingTrips } from './lib/notifications'
import { destinationSummary } from './lib/tripHelpers'
import { clearShareCodeFromLocation, readShareCodeFromLocation } from './lib/tripShare'
import { filterByWeather, templateForType } from './lib/packingTemplates'
import type { SharedTripData } from './lib/tripShare'
import type { ViewId } from './types'

export function App() {
  const store = useMeridian()
  const online = useOnlineStatus()
  const updateAvailable = useServiceWorkerUpdate()
  const [view, setView] = useState<ViewId>('trips')
  const [activeTripId, setActiveTripId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importCode, setImportCode] = useState<string | undefined>(undefined)

  // A shared-trip link lands with #share-trip=<code> — pick it up once on
  // load and offer to import it.
  useEffect(() => {
    const code = readShareCodeFromLocation()
    if (code) {
      setImportCode(code)
      setImportOpen(true)
    }
  }, [])

  // The manifest's "New trip" home-screen shortcut launches with
  // ?action=new-trip so long-pressing the installed app icon jumps
  // straight to the create dialog instead of the trips list. Drop the
  // param afterward so a reload (or sharing the URL) doesn't reopen it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('action') !== 'new-trip') return
    setCreateOpen(true)
    const url = new URL(window.location.href)
    url.searchParams.delete('action')
    window.history.replaceState(null, '', url.toString())
  }, [])

  const { data } = store

  // Reflect theme onto <html> so CSS variables re-cascade.
  useEffect(() => {
    document.documentElement.dataset.theme = data.settings.theme
    const themeMeta = document.querySelector('meta[name="theme-color"]')
    if (themeMeta) {
      themeMeta.setAttribute(
        'content',
        data.settings.theme === 'dark' ? '#000000' : '#f3f7fa',
      )
    }
  }, [data.settings.theme])

  // Local trip reminders (browser Notification API — no server). Scoped to
  // just the fields that can actually change whether a reminder is due —
  // depending on the whole `data` object meant a full trips scan plus a
  // localStorage read/write on every single edit anywhere in the app
  // (packing, expenses, notes, ...), not just ones that could affect this.
  useEffect(() => {
    void maybeNotifyUpcomingTrips(data)
    // `data` itself is intentionally omitted — see comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.trips, data.settings.remindersEnabled, data.settings.remindDaysBefore])

  // Surface it if the last save to localStorage failed (most likely the
  // device's storage quota is full) — this is the only copy of the data,
  // so failing silently would mean edits just vanish on next reload.
  useEffect(() => {
    if (store.persistError) {
      showToast(
        "Couldn't save your last change — device storage may be full. Export a backup from Settings to be safe.",
        'danger',
      )
    }
    // showToast is stable across renders (defined inline but only depends
    // on setToast, itself stable) — depending on it would defeat the
    // point of only firing on a false→true transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.persistError])

  const activeTrip = useMemo(
    () => (activeTripId ? data.trips.find((t) => t.id === activeTripId) ?? null : null),
    [activeTripId, data.trips],
  )

  const showToast: ToastFn = (text, tone = 'default', action) => {
    setToast({ id: Date.now(), text, tone, action })
  }

  const closeCreate = useCallback(() => setCreateOpen(false), [])

  const handleCreateTrip = (input: Parameters<typeof store.createTrip>[0]) => {
    const id = store.createTrip(input)
    setCreateOpen(false)

    // Seed packing list from the template + refresh weather in background.
    // Weather tags are added once the forecast comes back — for now we
    // seed with an empty tag set so all universal items are included.
    store.seedPackingForTrip(id, input.type, [])

    // Kick off the weather fetch; when it lands, layer in the items the
    // synchronous seed above deliberately left out (it seeds with an empty
    // tag set, so only universal, non-weather-tagged items exist so far).
    void store.refreshWeatherForTrip(id).then((forecast) => {
      if (!forecast) return
      const tags = store.derived.tagsFromForecast(forecast)
      const template = templateForType(input.type)
      const weatherItems = filterByWeather(template, tags).filter(
        (it) => it.weatherTags && it.weatherTags.length > 0,
      )
      if (weatherItems.length === 0) return
      store.addPackingItems(id, weatherItems)
      showToast(
        `Weather forecast ready — added ${weatherItems.length} weather-specific packing item${weatherItems.length !== 1 ? 's' : ''}.`,
        'success',
      )
    })

    // Refresh currency rates for the trip currency.
    void store.refreshRates(input.homeCurrency)

    setActiveTripId(id)
    setView('trip')
    showToast(`Trip "${input.name}" created.`, 'success')
  }

  const closeImport = useCallback(() => {
    setImportOpen(false)
    clearShareCodeFromLocation()
  }, [])

  const handleImportSharedTrip = (input: SharedTripData) => {
    const id = store.createTrip(input)
    setImportOpen(false)
    clearShareCodeFromLocation()
    setActiveTripId(id)
    setView('trip')
    showToast(`"${input.name}" added.`, 'success')
  }

  // Stable references: passed all the way down to TripCard/TripRow, which
  // are memo()'d specifically so a re-render one level up doesn't force
  // every visible card to re-render — that only holds if this callback
  // doesn't change identity on every App render too.
  const openTrip = useCallback((id: string) => {
    setActiveTripId(id)
    setView('trip')
  }, [])

  const backToTrips = useCallback(() => {
    setActiveTripId(null)
    setView('trips')
  }, [])

  // ------------------------------------------------------------- render

  const headerProps =
    view === 'trip' && activeTrip
      ? {
          title: activeTrip.name,
          subtitle: destinationSummary(activeTrip),
          onBack: backToTrips,
        }
      : view === 'settings'
        ? { title: 'Settings', subtitle: 'Preferences & data' }
        : view === 'help'
          ? { title: 'Help', subtitle: 'Guide & FAQ' }
          : {
            title: 'Trips',
            subtitle:
              data.trips.length === 0
                ? 'Plan your first one'
                : `${data.trips.length} on this device`,
            onAdd: () => setCreateOpen(true),
            addLabel: 'New trip',
          }

  return (
    <div className="app-shell" data-view={view}>
      <SideNav
        view={view}
        trips={data.trips}
        activeTripId={activeTripId}
        theme={data.settings.theme}
        open={navOpen}
        onClose={() => setNavOpen(false)}
        onNavigate={(next) => {
          setView(next)
          if (next !== 'trip') setActiveTripId(null)
        }}
        onOpenTrip={openTrip}
        onToggleTheme={store.toggleTheme}
      />

      <main className="app-main">
        <AppHeader {...headerProps} onOpenMenu={() => setNavOpen(true)} />

        <div className="app-scroll">
          <div className="container">
            {view === 'trips' && (
              <TripsView
                data={data}
                onOpenTrip={openTrip}
                onCreateTrip={() => setCreateOpen(true)}
                onImportSharedTrip={() => {
                  setImportCode(undefined)
                  setImportOpen(true)
                }}
              />
            )}

            {view === 'trip' && activeTrip && (
              <TripDetail
                trip={activeTrip}
                data={data}
                store={store}
                onBack={backToTrips}
                onToast={showToast}
              />
            )}
            {view === 'trip' && !activeTrip && (
              <EmptyState
                icon="warning"
                title="Trip not found"
                description="This trip may have been deleted or is on another device."
                action={
                  <button type="button" className="btn btn-primary" onClick={backToTrips}>
                    Back to trips
                  </button>
                }
              />
            )}

            {view === 'settings' && (
              <SettingsView data={data} store={store} onToast={showToast} />
            )}

            {view === 'help' && <HelpView />}
          </div>
        </div>
      </main>

      <CreateTripDialog
        open={createOpen}
        onClose={closeCreate}
        defaultHomeCurrency={data.settings.defaultHomeCurrency}
        onCreate={handleCreateTrip}
      />

      <ImportSharedTripDialog
        open={importOpen}
        onClose={closeImport}
        initialCode={importCode}
        onImport={handleImportSharedTrip}
      />

      {/* Both banners are standing state (not one-off events like a toast),
          so they stack in a shared corner rather than each claiming the
          same fixed position and overlapping when online status flips
          while an update happens to also be waiting. */}
      <div className="corner-banners">
        {!online && (
          <div className="offline-banner" role="status">
            <span className="offline-dot" aria-hidden />
            Offline — cached rates & forecasts still work.
          </div>
        )}

        {updateAvailable && (
          <div className="update-banner" role="status">
            <Icon name="refresh" size={14} />
            Update ready
            <button
              type="button"
              className="update-banner-btn"
              onClick={() => window.location.reload()}
            >
              Refresh
            </button>
          </div>
        )}
      </div>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}

