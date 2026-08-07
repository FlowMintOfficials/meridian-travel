import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMeridian } from './hooks/useMeridian'
import { useOnlineStatus } from './hooks/useInstallPrompt'
import { SideNav } from './components/SideNav'
import { AppHeader } from './components/AppHeader'
import { TripsView } from './components/TripsView'
import { TripDetail } from './components/TripDetail'
import { SettingsView } from './components/SettingsView'
import { HelpView } from './components/HelpView'
import { CreateTripDialog } from './components/CreateTripDialog'
import { Toast, type ToastFn, type ToastMessage } from './components/Toast'
import { EmptyState } from './components/EmptyState'
import { maybeNotifyUpcomingTrips } from './lib/notifications'
import { destinationSummary } from './lib/tripHelpers'
import type { ViewId } from './types'

export function App() {
  const store = useMeridian()
  const online = useOnlineStatus()
  const [view, setView] = useState<ViewId>('trips')
  const [activeTripId, setActiveTripId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const [toast, setToast] = useState<ToastMessage | null>(null)

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

  // Local trip reminders (browser Notification API — no server).
  useEffect(() => {
    void maybeNotifyUpcomingTrips(data)
  }, [data])

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

    // Kick off the weather fetch; when it lands, we re-seed the packing
    // list with weather-aware items only for a fresh trip (idempotent
    // check inside seedPackingForTrip prevents duplicates).
    void store.refreshWeatherForTrip(id).then((forecast) => {
      if (!forecast) return
      showToast('Weather forecast ready — packing list updated.', 'success')
    })

    // Refresh currency rates for the trip currency.
    void store.refreshRates(input.homeCurrency)

    setActiveTripId(id)
    setView('trip')
    showToast(`Trip "${input.name}" created.`, 'success')
  }

  const openTrip = (id: string) => {
    setActiveTripId(id)
    setView('trip')
  }

  const backToTrips = () => {
    setActiveTripId(null)
    setView('trips')
  }

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
        tripsCount={data.trips.length}
        theme={data.settings.theme}
        open={navOpen}
        onClose={() => setNavOpen(false)}
        onNavigate={(next) => {
          setView(next)
          if (next !== 'trip') setActiveTripId(null)
        }}
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

      {!online && (
        <div className="offline-banner" role="status">
          <span className="offline-dot" aria-hidden />
          Offline — cached rates & forecasts still work.
        </div>
      )}

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}

