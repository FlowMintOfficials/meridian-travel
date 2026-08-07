import { useEffect, useState, type ReactNode } from 'react'
import { Dialog } from './Dialog'
import { Icon, type IconName } from './Icon'

interface ConfirmDialogProps {
  open: boolean
  /** 'danger' tints the icon badge and confirm button red for destructive actions. */
  tone?: 'default' | 'danger'
  icon: IconName
  title: string
  description: ReactNode
  confirmLabel: string
  cancelLabel?: string
  /** Disables both buttons and swaps the confirm label for a spinner + busyLabel. */
  busy?: boolean
  busyLabel?: string
  /** When set, confirm stays disabled until the user types this phrase exactly (case-insensitive). */
  typedPhrase?: string
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDialog({
  open,
  tone = 'default',
  icon,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  busy = false,
  busyLabel = 'Working…',
  typedPhrase,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('')

  // Clear any typed confirmation phrase each time the dialog opens fresh.
  useEffect(() => {
    if (open) setTyped('')
  }, [open])

  const canConfirm = typedPhrase
    ? typed.trim().toLowerCase() === typedPhrase.toLowerCase()
    : true

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      dismissOnBackdrop={!busy}
      footer={
        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={!canConfirm || busy}
          >
            {busy ? (
              <>
                <Icon name="refresh" size={14} className="icon-spin" /> {busyLabel}
              </>
            ) : (
              <>
                <Icon name={icon} size={14} /> {confirmLabel}
              </>
            )}
          </button>
        </div>
      }
    >
      <div className={`confirm-dialog tone-${tone}`}>
        <span className="confirm-icon-badge" aria-hidden>
          <Icon name={icon} size={22} />
        </span>
        <div className="confirm-dialog-copy">{description}</div>

        {typedPhrase && (
          <label className="confirm-phrase">
            <span>
              Type <strong>“{typedPhrase}”</strong> to confirm
            </span>
            <input
              className="input confirm-phrase-input mono"
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={typedPhrase}
              autoComplete="off"
              autoFocus
              disabled={busy}
            />
          </label>
        )}
      </div>
    </Dialog>
  )
}
