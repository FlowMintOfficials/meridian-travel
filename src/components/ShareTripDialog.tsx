import { useMemo, useState } from 'react'
import { Dialog } from './Dialog'
import { Icon } from './Icon'
import { QrCode } from './QrCode'
import { buildShareUrl } from '../lib/tripShare'
import type { Trip } from '../types'

interface ShareTripDialogProps {
  trip: Trip
  open: boolean
  onClose: () => void
}

export function ShareTripDialog({ trip, open, onClose }: ShareTripDialogProps) {
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  // Rebuilt each time the dialog opens (not on every trip edit) so the
  // trip's current currencies/dates are what actually gets shared.
  const url = useMemo(() => (open ? buildShareUrl(trip) : ''), [open, trip])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setCopyError(false)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API unavailable or denied — the link is still visible
      // below to select and copy manually, but say so instead of the
      // button silently doing nothing.
      setCopyError(true)
      window.setTimeout(() => setCopyError(false), 4000)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Share trip"
      subtitle="Scan or send this to add the basics on another device — no account needed."
      size="sm"
      footer={
        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void handleCopy()}>
            <Icon name={copied ? 'check' : 'copy'} size={14} />
            {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
      }
    >
      <div className="share-trip">
        <div className="share-trip-qr">
          <QrCode data={url} size={220} />
        </div>
        <p className="share-trip-note">
          Includes name, dates, destinations, currencies, travelers, budget, and notes.
          Packing, itinerary, expenses, and photos aren’t included — they start fresh on
          the other device.
        </p>
        <p className="share-trip-link" title={url}>
          {url}
        </p>
        {copyError && (
          <p className="share-error">
            Couldn’t copy automatically — select the link above and copy it manually.
          </p>
        )}
      </div>
    </Dialog>
  )
}
