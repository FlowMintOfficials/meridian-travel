import { useMemo, useState } from 'react'
import { Icon, type IconName } from './Icon'
import { Dialog } from './Dialog'
import { ConfirmDialog } from './ConfirmDialog'
import { CreateTripDialog } from './CreateTripDialog'
import { ShareTripDialog } from './ShareTripDialog'
import { PeerSyncDialog } from './PeerSyncDialog'
import { TripOverviewTab } from './TripOverviewTab'
import { PackingTab } from './PackingTab'
import { ItineraryTab } from './ItineraryTab'
import { ExpensesTab } from './ExpensesTab'
import { DocsTab } from './DocsTab'
import { ChecklistTab } from './ChecklistTab'
import { PhotosTab } from './PhotosTab'
import { ToolkitTab } from './ToolkitTab'
import { CompleteTripDialog } from './CompleteTripDialog'
import { downloadTripSummary, printTripSummaryPdf } from '../lib/tripSummary'
import { useVaultDuressActive } from '../lib/vaultSession'
import {
  TRIP_TYPE_ICONS,
  TRIP_TYPE_LABELS,
  daysUntil,
  formatDateRange,
  primaryDestination,
  tripDurationDays,
  tripPhase,
} from '../lib/tripHelpers'
import type { MeridianData, Trip } from '../types'
import type { MeridianStore } from '../hooks/useMeridian'

type TripTab =
  | 'overview'
  | 'checklist'
  | 'packing'
  | 'itinerary'
  | 'expenses'
  | 'photos'
  | 'docs'
  | 'toolkit'

interface TripDetailProps {
  trip: Trip
  data: MeridianData
  store: MeridianStore
  onBack: () => void
  onToast: (text: string, tone?: 'default' | 'success' | 'danger' | 'info') => void
}

interface TabDef {
  id: TripTab
  label: string
  icon: IconName
}

const TABS: TabDef[] = [
  { id: 'overview', label: 'Overview', icon: 'compass' },
  { id: 'checklist', label: 'Checklist', icon: 'check' },
  { id: 'packing', label: 'Packing', icon: 'suitcase' },
  { id: 'itinerary', label: 'Itinerary', icon: 'map' },
  { id: 'expenses', label: 'Expenses', icon: 'wallet' },
  { id: 'photos', label: 'Photos', icon: 'image' },
  { id: 'docs', label: 'Docs', icon: 'fileText' },
  { id: 'toolkit', label: 'Toolkit', icon: 'plug' },
]

export function TripDetail({ trip, data, store, onBack, onToast }: TripDetailProps) {
  const [tab, setTab] = useState<TripTab>('overview')
  const [menuOpen, setMenuOpen] = useState(false)
  const [completeOpen, setCompleteOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [syncOpen, setSyncOpen] = useState(false)

  // If the vault is currently unlocked with the duress passphrase, the
  // real document count would give the game away right next to the
  // "empty vault" the Docs tab itself is showing — so it reads as 0
  // exactly like the decoy vault it's sitting beside.
  const duressActive = useVaultDuressActive()

  // Each of these arrays holds records for every trip in the app, not just
  // this one — memoized so switching tabs (or any edit made elsewhere
  // while this trip stays open) doesn't re-scan all six on every render.
  const counts: Record<TripTab, number> = useMemo(
    () => ({
      overview: 0,
      checklist: data.checklist.filter((c) => c.tripId === trip.id && c.status === 'todo').length,
      packing: data.packing.filter((p) => p.tripId === trip.id).length,
      itinerary: data.itinerary.filter((e) => e.tripId === trip.id).length,
      expenses: data.expenses.filter((e) => e.tripId === trip.id).length,
      photos: data.photos.filter((p) => p.tripId === trip.id).length,
      docs: duressActive ? 0 : data.documents.filter((d) => d.tripId === trip.id).length,
      toolkit: 0,
    }),
    [
      data.checklist,
      data.packing,
      data.itinerary,
      data.expenses,
      data.photos,
      data.documents,
      duressActive,
      trip.id,
    ],
  )

  // Trip identity now lives once, in the persistent rail — not repeated
  // inside the Overview tab's own content every time you switch back to it.
  const phase = tripPhase(trip)
  const until = daysUntil(trip.startDate)
  const duration = tripDurationDays(trip.startDate, trip.endDate)
  const countdownLabel =
    phase === 'completed'
      ? 'Completed'
      : phase === 'upcoming'
        ? until === 0
          ? 'Starts today'
          : until === 1
            ? 'Tomorrow'
            : `In ${until} days`
        : phase === 'in-progress'
          ? 'On the road'
          : 'Wrapped'

  const handleReopen = () => {
    store.reopenTrip(trip.id)
    onToast(`"${trip.name}" reopened.`, 'info')
  }

  const handleDownloadSummary = () => {
    downloadTripSummary(trip, data)
    onToast('Trip summary downloaded.', 'success')
  }

  const handlePdfSummary = () => {
    printTripSummaryPdf(trip, data)
    onToast('Print dialog opened — choose Save as PDF.', 'info')
  }

  const handleArchive = () => {
    store.archiveTrip(trip.id)
    onToast(`"${trip.name}" archived.`, 'info')
    onBack()
  }

  const handleUnarchive = () => {
    store.unarchiveTrip(trip.id)
    onToast(`"${trip.name}" unarchived.`)
  }

  const handleDuplicate = () => {
    store.duplicateTrip(trip.id)
    onToast(`Duplicated "${trip.name}".`, 'success')
    onBack()
  }

  const handleSaveEdit = (id: string, input: Parameters<typeof store.updateTrip>[1]) => {
    store.updateTrip(id, input)
    setEditOpen(false)
    onToast('Trip updated.', 'success')
  }

  const handleDelete = () => setDeleteOpen(true)

  const confirmDelete = () => {
    store.deleteTrip(trip.id)
    setDeleteOpen(false)
    onToast(`"${trip.name}" deleted.`, 'danger')
    onBack()
  }

  return (
    <div className="trip-shell">
      <aside className="trip-rail">
        <div
          className="trip-rail-hero"
          style={{ background: trip.coverGradient ?? 'var(--sunset)' }}
        >
          <div className="trip-rail-hero-veil" />
          <span className="chip accent trip-rail-phase-chip">
            {phase === 'upcoming' && <Icon name="clock" size={11} />}
            {phase === 'in-progress' && <Icon name="sparkle" size={11} />}
            {phase === 'completed' && <Icon name="check" size={11} />}
            {phase === 'past' && <Icon name="archive" size={11} />}
            {countdownLabel}
          </span>
          <h2 className="trip-rail-name">{primaryDestination(trip)}</h2>
          <p className="trip-rail-dates mono">
            {formatDateRange(trip.startDate, trip.endDate)} · {duration}d
          </p>
          <p className="trip-rail-type">
            <Icon name={TRIP_TYPE_ICONS[trip.type] as IconName} size={12} />
            {TRIP_TYPE_LABELS[trip.type]}
          </p>
        </div>

        <nav
          className="trip-rail-nav"
          role="tablist"
          aria-label="Trip sections"
          aria-orientation="vertical"
          onKeyDown={(e) => {
            if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return
            e.preventDefault()
            const i = TABS.findIndex((t) => t.id === tab)
            const next =
              e.key === 'Home'
                ? 0
                : e.key === 'End'
                  ? TABS.length - 1
                  : e.key === 'ArrowDown'
                    ? (i + 1) % TABS.length
                    : (i - 1 + TABS.length) % TABS.length
            setTab(TABS[next].id)
            document.getElementById(`trip-tab-${TABS[next].id}`)?.focus()
          }}
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              id={`trip-tab-${t.id}`}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              aria-controls="trip-tabpanel"
              tabIndex={tab === t.id ? 0 : -1}
              className={`trip-rail-tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <Icon name={t.icon} size={15} />
              <span className="trip-rail-tab-label">{t.label}</span>
              {counts[t.id] > 0 && (
                <span className="trip-tab-count mono">{counts[t.id]}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="trip-rail-actions">
          <button type="button" className="btn" onClick={() => setEditOpen(true)}>
            <Icon name="edit" size={14} />
            <span>Edit</span>
          </button>
          <button type="button" className="btn" onClick={() => setShareOpen(true)}>
            <Icon name="qr" size={14} />
            <span>Share</span>
          </button>
          <button
            type="button"
            className="btn btn-icon"
            onClick={() => setMenuOpen(true)}
            aria-label="More trip actions"
            title="More trip actions"
          >
            <Icon name="more" size={14} />
          </button>
        </div>
      </aside>

      <div
        className="trip-main"
        role="tabpanel"
        id="trip-tabpanel"
        aria-labelledby={`trip-tab-${tab}`}
        tabIndex={-1}
      >
        {tab === 'overview' && (
          <TripOverviewTab
            trip={trip}
            data={data}
            store={store}
            onNavigateTab={setTab}
            onToast={onToast}
            onRequestComplete={() => setCompleteOpen(true)}
          />
        )}

        {tab === 'checklist' && (
          <ChecklistTab trip={trip} data={data} store={store} onToast={onToast} />
        )}

        {tab === 'packing' && (
          <PackingTab trip={trip} data={data} store={store} onToast={onToast} />
        )}

        {tab === 'itinerary' && (
          <ItineraryTab trip={trip} data={data} store={store} onToast={onToast} />
        )}

        {tab === 'expenses' && (
          <ExpensesTab trip={trip} data={data} store={store} onToast={onToast} />
        )}

        {tab === 'photos' && (
          <PhotosTab trip={trip} data={data} store={store} onToast={onToast} />
        )}

        {tab === 'docs' && (
          <DocsTab trip={trip} data={data} store={store} onToast={onToast} />
        )}

        {tab === 'toolkit' && <ToolkitTab trip={trip} data={data} />}
      </div>

      {menuOpen && (
        <Dialog
          open
          onClose={() => setMenuOpen(false)}
          title="Trip actions"
          size="sm"
          footer={
            <div className="dialog-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setMenuOpen(false)}
              >
                Close
              </button>
            </div>
          }
        >
          <div className="action-list">
            <button
              type="button"
              className="action-item"
              onClick={() => {
                setMenuOpen(false)
                setShareOpen(true)
              }}
            >
              <Icon name="qr" size={16} />
              <div>
                <strong>Share trip</strong>
                <p>QR code or link to add the basics on another device.</p>
              </div>
            </button>
            <button
              type="button"
              className="action-item"
              onClick={() => {
                setMenuOpen(false)
                setSyncOpen(true)
              }}
            >
              <Icon name="refresh" size={16} />
              <div>
                <strong>Sync with another device</strong>
                <p>
                  Direct device-to-device pairing — merges packing, itinerary, checklist &amp;
                  expenses both ways. No server, no account.
                </p>
              </div>
            </button>
            {trip.completed ? (
              <>
                <button
                  type="button"
                  className="action-item"
                  onClick={() => {
                    setMenuOpen(false)
                    handleDownloadSummary()
                  }}
                >
                  <Icon name="download" size={16} />
                  <div>
                    <strong>Download summary</strong>
                    <p>HTML report — open anytime offline.</p>
                  </div>
                </button>
                <button
                  type="button"
                  className="action-item"
                  onClick={() => {
                    setMenuOpen(false)
                    handlePdfSummary()
                  }}
                >
                  <Icon name="print" size={16} />
                  <div>
                    <strong>Save as PDF</strong>
                    <p>Opens print → choose Save as PDF. No server needed.</p>
                  </div>
                </button>
                <button
                  type="button"
                  className="action-item"
                  onClick={() => {
                    setMenuOpen(false)
                    handleReopen()
                  }}
                >
                  <Icon name="refresh" size={16} />
                  <div>
                    <strong>Reopen trip</strong>
                    <p>Mark this trip as active again.</p>
                  </div>
                </button>
              </>
            ) : (
              <button
                type="button"
                className="action-item"
                onClick={() => {
                  setMenuOpen(false)
                  setCompleteOpen(true)
                }}
              >
                <Icon name="check" size={16} />
                <div>
                  <strong>Complete trip</strong>
                  <p>Check packing &amp; budget, then unlock your summary.</p>
                </div>
              </button>
            )}
            <button
              type="button"
              className="action-item"
              onClick={() => {
                setMenuOpen(false)
                handleDuplicate()
              }}
            >
              <Icon name="copy" size={16} />
              <div>
                <strong>Duplicate trip</strong>
                <p>Copy everything except expenses. Great for repeat itineraries.</p>
              </div>
            </button>
            {trip.archived ? (
              <button
                type="button"
                className="action-item"
                onClick={() => {
                  setMenuOpen(false)
                  handleUnarchive()
                }}
              >
                <Icon name="unlock" size={16} />
                <div>
                  <strong>Unarchive</strong>
                  <p>Move this trip back to your active list.</p>
                </div>
              </button>
            ) : (
              <button
                type="button"
                className="action-item"
                onClick={() => {
                  setMenuOpen(false)
                  handleArchive()
                }}
              >
                <Icon name="archive" size={16} />
                <div>
                  <strong>Archive trip</strong>
                  <p>Hide from the main list without deleting anything.</p>
                </div>
              </button>
            )}
            <button
              type="button"
              className="action-item danger"
              onClick={() => {
                setMenuOpen(false)
                handleDelete()
              }}
            >
              <Icon name="trash" size={16} />
              <div>
                <strong>Delete trip</strong>
                <p>Erase this trip and every packing item, event, expense.</p>
              </div>
            </button>
          </div>
        </Dialog>
      )}

      {completeOpen && (
        <CompleteTripDialog
          trip={trip}
          data={data}
          store={store}
          onClose={() => setCompleteOpen(false)}
          onNavigateTab={(t) => setTab(t)}
          onCompleted={() => {
            setCompleteOpen(false)
            setTab('overview')
            onToast(
              `"${trip.name}" marked complete. Download your summary below.`,
              'success',
            )
          }}
        />
      )}

      <CreateTripDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        defaultHomeCurrency={data.settings.defaultHomeCurrency}
        existing={trip}
        onSave={handleSaveEdit}
      />

      <ShareTripDialog trip={trip} open={shareOpen} onClose={() => setShareOpen(false)} />

      {syncOpen && (
        <PeerSyncDialog
          trip={trip}
          data={data}
          store={store}
          onClose={() => setSyncOpen(false)}
          onToast={onToast}
        />
      )}

      <ConfirmDialog
        open={deleteOpen}
        tone="danger"
        icon="trash"
        title="Delete this trip?"
        description={
          <>
            Permanently delete <strong>{trip.name}</strong> and all its packing, itinerary,
            and expenses. <strong>This cannot be undone.</strong>
          </>
        }
        confirmLabel="Delete trip"
        onConfirm={confirmDelete}
        onClose={() => setDeleteOpen(false)}
      />
    </div>
  )
}
