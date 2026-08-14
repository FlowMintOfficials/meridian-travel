import { daysUntil, todayISO } from './tripHelpers'
import type { MeridianData } from '../types'

const SCHEDULE_KEY = 'meridian:reminders:last'

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export async function ensureNotificationPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return 'denied'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  return Notification.requestPermission()
}

/** Fire local reminders for upcoming trips (at most once per day per trip). */
export async function maybeNotifyUpcomingTrips(data: MeridianData): Promise<number> {
  if (!data.settings.remindersEnabled) return 0
  if (!notificationsSupported()) return 0
  if (Notification.permission !== 'granted') return 0

  const daysBefore = Math.max(1, data.settings.remindDaysBefore || 3)
  const today = todayISO()
  let last: Record<string, string> = {}
  try {
    last = JSON.parse(localStorage.getItem(SCHEDULE_KEY) ?? '{}') as Record<string, string>
  } catch {
    last = {}
  }

  let sent = 0
  for (const trip of data.trips) {
    if (trip.archived || trip.completed) continue
    const until = daysUntil(trip.startDate)
    if (until < 0 || until > daysBefore) continue
    const key = `${trip.id}:${until}`
    if (last[key] === today) continue

    const body =
      until === 0
        ? `${trip.name} starts today. Packing & checklist ready?`
        : until === 1
          ? `${trip.name} starts tomorrow.`
          : `${trip.name} starts in ${until} days.`

    try {
      new Notification('Meridian', { body, tag: key })
      last[key] = today
      sent += 1
    } catch {
      // ignore
    }
  }

  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(last))
  return sent
}
