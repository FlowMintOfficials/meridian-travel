import { useEffect, useState } from 'react'
import { Dialog } from './Dialog'
import { Icon, type IconName } from './Icon'
import { decodeSharedTrip, extractShareCode, type SharedTripData } from '../lib/tripShare'
import { TRIP_TYPE_ICONS, TRIP_TYPE_LABELS, formatDateRange } from '../lib/tripHelpers'

interface ImportSharedTripDialogProps {
  open: boolean
  onClose: () => void
  /** Pre-filled when opened from a detected share link — skips straight
   * to the preview instead of asking the user to paste anything. */
  initialCode?: string
  onImport: (data: SharedTripData) => void
}

export function ImportSharedTripDialog({
  open,
  onClose,
  initialCode,
  onImport,
}: ImportSharedTripDialogProps) {
  const [pasted, setPasted] = useState('')
  const [preview, setPreview] = useState<SharedTripData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setPasted('')
    if (initialCode) {
      const decoded = decodeSharedTrip(initialCode)
      setPreview(decoded)
      setError(decoded ? null : 'This shared trip link looks invalid or corrupted.')
    } else {
      setPreview(null)
      setError(null)
    }
  }, [open, initialCode])

  const handleDecode = () => {
    const code = extractShareCode(pasted)
    if (!code) {
      setError('That doesn’t look like a Meridian share link or code.')
      return
    }
    const decoded = decodeSharedTrip(code)
    if (!decoded) {
      setError('This shared trip code looks invalid or corrupted.')
      return
    }
    setError(null)
    setPreview(decoded)
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={preview ? 'Add this trip?' : 'Import a shared trip'}
      subtitle={
        preview
          ? 'Review what will be added — everything stays editable afterward.'
          : 'Paste the link or code someone sent you.'
      }
      size="sm"
      footer={
        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          {preview ? (
            <button type="button" className="btn btn-primary" onClick={() => onImport(preview)}>
              <Icon name="plus" size={14} /> Add trip
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleDecode}
              disabled={!pasted.trim()}
            >
              Preview
            </button>
          )}
        </div>
      }
    >
      {preview ? (
        <div className="share-preview">
          <span className="settings-icon">
            <Icon name={TRIP_TYPE_ICONS[preview.type] as IconName} size={18} />
          </span>
          <div className="share-preview-body">
            <strong>{preview.name}</strong>
            <p>
              {formatDateRange(preview.startDate, preview.endDate)}
              {preview.destinations.length > 0 && (
                <> · {preview.destinations.map((d) => d.city).join(', ')}</>
              )}
            </p>
            <p className="share-preview-meta">
              <Icon name="wallet" size={12} /> {TRIP_TYPE_LABELS[preview.type]} ·{' '}
              {preview.tripCurrency} → {preview.homeCurrency}
              {preview.travelers.length > 0 && <> · {preview.travelers.join(', ')}</>}
            </p>
          </div>
        </div>
      ) : (
        <label className="label">
          <span>Link or code</span>
          <textarea
            className="textarea"
            rows={3}
            value={pasted}
            onChange={(e) => {
              setPasted(e.target.value)
              setError(null)
            }}
            placeholder="Paste what they sent you…"
            maxLength={8000}
            autoFocus
          />
        </label>
      )}
      {error && <p className="share-error">{error}</p>}
    </Dialog>
  )
}
