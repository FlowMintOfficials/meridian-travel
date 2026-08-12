import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Shown above the reload button — keep short. */
  label?: string
}

interface State {
  error: Error | null
}

/**
 * Last-resort catch-all so a render-time exception anywhere in the tree
 * (a malformed imported backup, a crafted share link, an unexpected null)
 * shows a recoverable screen instead of silently white-screening the whole
 * app. Meridian's data lives in localStorage regardless of what React does,
 * so a reload always recovers — the point of this is just to say so.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[meridian] unhandled render error', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div className="error-boundary">
        <div className="error-boundary-card">
          <p className="error-boundary-eyebrow">Meridian hit a snag</p>
          <h1>{this.props.label ?? 'Something went wrong rendering this screen.'}</h1>
          <p>
            Your trip data is safe — it lives on this device, not in this screen. Reloading
            almost always fixes this.
          </p>
          <div className="error-boundary-actions">
            <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
              Reload Meridian
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => this.setState({ error: null })}
            >
              Try continuing anyway
            </button>
          </div>
          <details>
            <summary>Technical details</summary>
            <pre>{error.message}</pre>
          </details>
        </div>
      </div>
    )
  }
}
