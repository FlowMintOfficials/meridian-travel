import { Icon } from './Icon'

interface AppHeaderProps {
  title: string
  subtitle?: string
  onOpenMenu: () => void
  onAdd?: () => void
  addLabel?: string
  onBack?: () => void
}

export function AppHeader({
  title,
  subtitle,
  onOpenMenu,
  onAdd,
  addLabel = 'New',
  onBack,
}: AppHeaderProps) {
  return (
    <header className="app-header">
      <button
        type="button"
        className="header-menu"
        onClick={onOpenMenu}
        aria-label="Open navigation"
      >
        <Icon name="menu" size={18} />
      </button>

      {onBack && (
        <button
          type="button"
          className="btn btn-ghost header-back"
          onClick={onBack}
        >
          <Icon name="chevronLeft" size={16} />
          <span>Back</span>
        </button>
      )}

      <div className="header-title">
        <strong>{title}</strong>
        {subtitle && <small>{subtitle}</small>}
      </div>

      {onAdd && (
        <button type="button" className="btn btn-primary header-add" onClick={onAdd}>
          <Icon name="plus" size={15} />
          <span>{addLabel}</span>
        </button>
      )}
    </header>
  )
}
