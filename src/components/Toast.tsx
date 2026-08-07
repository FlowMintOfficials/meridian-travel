import { useEffect } from 'react'
import { Icon } from './Icon'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastMessage {
  id: number
  text: string
  tone?: 'default' | 'success' | 'danger' | 'info'
  action?: ToastAction
}

/** Shape every onToast prop across the app should accept — lets tabs attach an Undo action. */
export type ToastFn = (
  text: string,
  tone?: ToastMessage['tone'],
  action?: ToastAction,
) => void

interface ToastProps {
  toast: ToastMessage | null
  onDismiss: () => void
}

export function Toast({ toast, onDismiss }: ToastProps) {
  useEffect(() => {
    if (!toast) return
    // Give action toasts (e.g. "Undo") longer to react to before they vanish.
    const id = window.setTimeout(onDismiss, toast.action ? 5000 : 3200)
    return () => window.clearTimeout(id)
  }, [toast, onDismiss])

  if (!toast) return null

  return (
    <div className={`toast toast-${toast.tone ?? 'default'}`} role="status" aria-live="polite">
      <Icon
        name={
          toast.tone === 'danger'
            ? 'warning'
            : toast.tone === 'success'
              ? 'check'
              : toast.tone === 'info'
                ? 'info'
                : 'sparkle'
        }
        size={16}
      />
      <span>{toast.text}</span>
      {toast.action && (
        <button
          type="button"
          className="toast-action"
          onClick={() => {
            toast.action?.onClick()
            onDismiss()
          }}
        >
          {toast.action.label}
        </button>
      )}
    </div>
  )
}
