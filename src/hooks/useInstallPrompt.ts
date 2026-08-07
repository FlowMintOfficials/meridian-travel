import { useEffect, useState } from 'react'

/** Chrome/Edge fire this before showing their own install UI. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * useInstallPrompt — captures the browser's install invitation and lets
 * you trigger it later from a button. Returns null on browsers that
 * don't support installable web apps (Safari, older FF).
 */
export function useInstallPrompt(): {
  canInstall: boolean
  isInstalled: boolean
  prompt: () => Promise<void>
} {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(() =>
    window.matchMedia('(display-mode: standalone)').matches,
  )

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    const installedHandler = () => {
      setInstalled(true)
      setDeferred(null)
    }
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', installedHandler)
    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  return {
    canInstall: !!deferred && !installed,
    isInstalled: installed,
    prompt: async () => {
      if (!deferred) return
      await deferred.prompt()
      const choice = await deferred.userChoice
      if (choice.outcome === 'accepted') setInstalled(true)
      setDeferred(null)
    },
  }
}

/** Track online / offline status so we can nudge the user when APIs
 * (currency, weather) go stale. */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}
