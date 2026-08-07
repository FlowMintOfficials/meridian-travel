import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

interface EmptyStateProps {
  icon?: IconName
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon = 'compass', title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-state-mark" aria-hidden>
        <Icon name={icon} size={30} />
      </div>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  )
}
