import { useEffect, useRef, type ReactNode } from 'react'
import { Icon } from './Icon'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
  footer?: ReactNode
  /** When false, clicking the backdrop is ignored. Defaults to true. */
  dismissOnBackdrop?: boolean
}

export function Dialog({
  open,
  onClose,
  title,
  subtitle,
  size = 'md',
  children,
  footer,
  dismissOnBackdrop = true,
}: DialogProps) {
  const surfaceRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  const wasOpenRef = useRef(false)

  // Keep latest onClose without re-running the open effect (which would
  // steal focus from inputs on every parent re-render).
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false
      return
    }

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    window.addEventListener('keydown', handleKey)

    // Focus the surface only when the dialog *opens*, never again while
    // it stays open — otherwise typing in child inputs loses focus.
    if (!wasOpenRef.current) {
      wasOpenRef.current = true
      // Defer so autoFocus children (e.g. trip name) win when present.
      const id = window.requestAnimationFrame(() => {
        const active = document.activeElement
        const surface = surfaceRef.current
        if (!surface) return
        if (active && surface.contains(active) && active !== surface) return
        surface.focus()
      })
      return () => {
        window.cancelAnimationFrame(id)
        document.body.style.overflow = prevOverflow
        window.removeEventListener('keydown', handleKey)
      }
    }

    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', handleKey)
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className="dialog-scrim"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      onClick={(e) => {
        if (dismissOnBackdrop && e.target === e.currentTarget) onCloseRef.current()
      }}
    >
      <div
        className={`dialog-surface size-${size}`}
        tabIndex={-1}
        ref={surfaceRef}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <header className="dialog-head">
          <div className="dialog-title-block">
            <h2 id="dialog-title">{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            type="button"
            className="dialog-close"
            onClick={() => onCloseRef.current()}
            aria-label="Close dialog"
          >
            <Icon name="close" size={18} />
          </button>
        </header>
        <div className="dialog-body">{children}</div>
        {footer && <footer className="dialog-foot">{footer}</footer>}
      </div>
    </div>
  )
}
