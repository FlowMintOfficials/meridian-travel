import { useEffect, useMemo, useState } from 'react'
import { Icon } from './Icon'
import { EmptyState } from './EmptyState'
import { getPhotoBlob, putPhotoBlob } from '../lib/photos'
import { addDays, formatDay, makeId, tripDurationDays } from '../lib/tripHelpers'
import type { ToastFn } from './Toast'
import type { MeridianData, Trip, TripPhoto } from '../types'
import type { MeridianStore } from '../hooks/useMeridian'

interface PhotosTabProps {
  trip: Trip
  data: MeridianData
  store: MeridianStore
  onToast: ToastFn
}

const MAX_BYTES = 2_500_000

export function PhotosTab({ trip, data, store, onToast }: PhotosTabProps) {
  const duration = tripDurationDays(trip.startDate, trip.endDate)
  const [day, setDay] = useState(1)
  const [busy, setBusy] = useState(false)
  const photos = useMemo(
    () =>
      data.photos
        .filter((p) => p.tripId === trip.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data.photos, trip.id],
  )

  const byDay = useMemo(() => {
    const map = new Map<number, TripPhoto[]>()
    for (const p of photos) {
      const arr = map.get(p.day) ?? []
      arr.push(p)
      map.set(p.day, arr)
    }
    return map
  }, [photos])

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) {
          onToast('Only images are supported.', 'danger')
          continue
        }
        if (file.size > MAX_BYTES) {
          onToast(`${file.name} is too large (max ~2.5 MB).`, 'danger')
          continue
        }
        const id = makeId('pic')
        await putPhotoBlob(id, file)
        store.addPhotoMeta({
          id,
          tripId: trip.id,
          day,
          mime: file.type,
          size: file.size,
          createdAt: new Date().toISOString(),
          caption: file.name.replace(/\.[^.]+$/, ''),
        })
      }
      onToast('Photo saved on this device.', 'success')
    } catch (err) {
      console.warn(err)
      onToast('Could not save photo.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (photo: TripPhoto) => {
    // Grab the blob before deleting so "Undo" can put it right back.
    const blob = await getPhotoBlob(photo.id).catch(() => null)
    store.deletePhoto(photo.id)
    onToast(
      'Photo deleted.',
      'info',
      blob
        ? {
            label: 'Undo',
            onClick: () => {
              void putPhotoBlob(photo.id, blob).then(() => store.addPhotoMeta(photo))
            },
          }
        : undefined,
    )
  }

  if (photos.length === 0) {
    return (
      <div className="photos-tab">
        <EmptyState
          icon="image"
          title="Trip journal"
          description="Photos stay on this device (IndexedDB) — never uploaded. Great for a private scrapbook."
          action={
            <label className="btn btn-primary">
              <Icon name="plus" size={14} /> Add photos
              <input
                type="file"
                accept="image/*"
                multiple
                hidden
                disabled={busy}
                onChange={(e) => {
                  void handleFiles(e.target.files)
                  e.target.value = ''
                }}
              />
            </label>
          }
        />
        <div className="photos-day-pick">
          <label className="label">
            <span>Day for new photos</span>
            <select className="select" value={day} onChange={(e) => setDay(Number(e.target.value))}>
              {Array.from({ length: duration }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  Day {d} — {formatDay(addDays(trip.startDate, d - 1))}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    )
  }

  return (
    <section className="photos-tab">
      <header className="photos-head">
        <div>
          <p className="exp-eyebrow">
            <Icon name="image" size={12} /> Journal
          </p>
          <strong className="mono">{photos.length}</strong>
          <small> photo{photos.length !== 1 && 's'} on this device</small>
        </div>
        <div className="photos-head-actions">
          <select className="select" value={day} onChange={(e) => setDay(Number(e.target.value))}>
            {Array.from({ length: duration }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                Day {d}
              </option>
            ))}
          </select>
          <label className="btn btn-primary">
            <Icon name="plus" size={14} /> {busy ? 'Saving…' : 'Add'}
            <input
              type="file"
              accept="image/*"
              multiple
              hidden
              disabled={busy}
              onChange={(e) => {
                void handleFiles(e.target.files)
                e.target.value = ''
              }}
            />
          </label>
        </div>
      </header>

      {Array.from({ length: duration }, (_, i) => i + 1).map((d) => {
        const list = byDay.get(d) ?? []
        if (list.length === 0) return null
        return (
          <div key={d} className="photos-day">
            <h3>
              Day {d}{' '}
              <span>{formatDay(addDays(trip.startDate, d - 1))}</span>
            </h3>
            <div className="photos-grid">
              {list.map((p) => (
                <PhotoThumb
                  key={p.id}
                  photo={p}
                  onDelete={() => void handleDelete(p)}
                  onCaption={(caption) => store.updatePhotoMeta(p.id, { caption })}
                />
              ))}
            </div>
          </div>
        )
      })}
    </section>
  )
}

function PhotoThumb({
  photo,
  onDelete,
  onCaption,
}: {
  photo: TripPhoto
  onDelete: () => void
  onCaption: (caption: string) => void
}) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let revoked: string | null = null
    let alive = true
    void getPhotoBlob(photo.id).then((blob) => {
      if (!alive || !blob) return
      const u = URL.createObjectURL(blob)
      revoked = u
      setUrl(u)
    })
    return () => {
      alive = false
      if (revoked) URL.revokeObjectURL(revoked)
    }
  }, [photo.id])

  return (
    <figure className="photo-card">
      {url ? <img src={url} alt={photo.caption || 'Trip photo'} /> : <div className="photo-skeleton" />}
      <figcaption>
        <input
          className="input"
          type="text"
          value={photo.caption ?? ''}
          onChange={(e) => onCaption(e.target.value)}
          placeholder="Caption"
        />
        <button type="button" className="pack-mini danger" onClick={onDelete} aria-label="Delete">
          <Icon name="trash" size={12} />
        </button>
      </figcaption>
    </figure>
  )
}
