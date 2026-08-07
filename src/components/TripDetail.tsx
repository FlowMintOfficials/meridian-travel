import { useState } from 'react'
import { Icon, type IconName } from './Icon'
import { Dialog } from './Dialog'
import { ConfirmDialog } from './ConfirmDialog'
import { CreateTripDialog } from './CreateTripDialog'
import { TripOverviewTab } from './TripOverviewTab'
import { PackingTab } from './PackingTab'
import { ItineraryTab } from './ItineraryTab'
import { ExpensesTab } from './ExpensesTab'
import { DocsTab } from './DocsTab'
import { ChecklistTab } from './ChecklistTab'
import { PhotosTab } from './PhotosTab'
import { CompleteTripDialog } from './CompleteTripDialog'
import { downloadTripSummary, printTripSummaryPdf } from '../lib/tripSummary'
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
]

export function TripDetail({ trip, data, store, onBack, onToast }: TripDetailProps) {
  const [tab, setTab] = useState<TripTab>('overview')
  const [menuOpen, setMenuOpen] = useState(false)
  const [completeOpen, setCompleteOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  const packingCount = data.packing.filter((p) => p.tripId === trip.id).length
  const itineraryCount = data.itinerary.filter((e) => e.tripId === trip.id).length
  const expenseCount = data.expenses.filter((e) => e.tripId === trip.id).length
  const docsCount = data.documents.filter((d) => d.tripId === trip.id).length
  const checkCount = data.checklist.filter(
    (c) => c.tripId === trip.id && c.status === 'todo',
  ).length
  const photoCount = data.photos.filter((p) => p.tripId === trip.id).length

  const counts: Record<TripTab, number> = {
    overview: 0,
    checklist: checkCount,
    packing: packingCount,
    itinerary: itineraryCount,
    expenses: expenseCount,
    photos: photoCount,
    docs: docsCount,
  }

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
    <div className="trip-detail">
      <div className="trip-detail-toolbar">
        <div className="trip-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`trip-tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <Icon name={t.icon} size={14} />
              <span>{t.label}</span>
              {counts[t.id] > 0 && (
                <span className="trip-tab-count mono">{counts[t.id]}</span>
              )}
            </button>
          ))}
        </div>
        <div className="trip-toolbar-actions">
          <button
            type="button"
            className="btn"
            onClick={() => setEditOpen(true)}
            aria-label="Edit trip"
            title="Edit trip"
          >
            <Icon name="edit" size={16} />
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => setMenuOpen(true)}
            aria-label="Trip actions"
            title="More trip actions"
          >
            <Icon name="more" size={16} />
          </button>
        </div>
      </div>

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
