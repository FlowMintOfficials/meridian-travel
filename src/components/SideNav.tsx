import { Icon, type IconName } from './Icon'
import type { ViewId } from '../types'

interface SideNavProps {
  view: ViewId
  tripsCount: number
  theme: 'dark' | 'light'
  open: boolean
  onClose: () => void
  onNavigate: (view: ViewId) => void
  onToggleTheme: () => void
}

interface NavEntry {
  id: ViewId
  label: string
  icon: IconName
  hint: string
}

const NAV: NavEntry[] = [
  { id: 'trips', label: 'Trips', icon: 'suitcase', hint: 'All your journeys' },
  { id: 'settings', label: 'Settings', icon: 'settings', hint: 'Preferences & data' },
  { id: 'help', label: 'Help', icon: 'helpCircle', hint: 'Guide & FAQ' },
]

export function SideNav({
  view,
  tripsCount,
  theme,
  open,
  onClose,
  onNavigate,
  onToggleTheme,
}: SideNavProps) {
  const activeView = view === 'trip' ? 'trips' : view

  return (
    <>
      {open && <div className="side-scrim" onClick={onClose} aria-hidden />}
      <aside className={`app-side ${open ? 'open' : ''}`} aria-label="Primary navigation">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            <Icon name="compass" size={22} />
          </span>
          <div className="brand-copy">
            <strong>Meridian</strong>
            <small>Travel companion</small>
          </div>
          <button
            type="button"
            className="side-close"
            onClick={onClose}
            aria-label="Close navigation"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <nav className="app-nav">
          {NAV.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={`nav-item ${activeView === entry.id ? 'active' : ''}`}
              onClick={() => {
                onNavigate(entry.id)
                onClose()
              }}
            >
              <Icon name={entry.icon} size={17} />
              <span className="nav-item-label">{entry.label}</span>
              {entry.id === 'trips' && tripsCount > 0 && (
                <span className="nav-count mono">{tripsCount}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="app-side-foot">
          <button type="button" className="foot-btn" onClick={onToggleTheme}>
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </div>
      </aside>
    </>
  )
}
