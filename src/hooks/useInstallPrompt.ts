import { useEffect, useState } from 'react'

/** Chrome/Edge fire this before showing their own install UI. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** iOS/iPadOS Safari never fires `beforeinstallprompt` — there's no
 * programmatic install API at all, only the manual Share sheet -> "Add to
 * Home Screen" flow. Detected once at module scope since the UA/platform
 * never changes mid-session. iPadOS 13+ reports as "Macintosh" in its UA
 * string (desktop-class Safari), so a touch-capable "Mac" is the tell. */
function detectIos(): boolean {
  if (typeof navigator === 'undefined') return false
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

/**
 * useInstallPrompt — captures the browser's install invitation and lets
 * you trigger it later from a button. `canInstall` stays false on browsers
 * that don't support installable web apps (Safari, older FF) — check
 * `isIosDevice` on those to offer the manual Share-sheet instructions
 * instead of a button that would otherwise never appear.
 */
export function useInstallPrompt(): {
  canInstall: boolean
  isInstalled: boolean
  isIosDevice: boolean
  prompt: () => Promise<void>
} {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(() =>
    window.matchMedia('(display-mode: standalone)').matches,
  )
  const [isIosDevice] = useState(detectIos)

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
    isIosDevice,
    prompt: async () => {
      if (!deferred) return
      // Callers just fire-and-forget this (`void install.prompt()`), so an
      // unhandled rejection here — e.g. `InvalidStateError` from calling
      // `.prompt()` on an already-consumed event, which can happen on a
      // rapid double-click before `deferred` clears — would otherwise
      // surface nowhere. Fail closed: clear the stale prompt and stop.
      try {
        await deferred.prompt()
        const choice = await deferred.userChoice
        if (choice.outcome === 'accepted') setInstalled(true)
      } catch (err) {
        console.warn('[meridian] install prompt failed', err)
      } finally {
        setDeferred(null)
      }
    },
  }
}

/** Flags once a new build has taken over the service worker while this tab
 * was already open. sw.js calls `skipWaiting()`/`clients.claim()`
 * unconditionally on install, so a new version activates and takes control
 * immediately rather than waiting for every tab to close first — great for
 * always shipping the latest offline shell, except the JS/CSS this tab
 * already has loaded in memory is now stale relative to what the cache (and
 * any fresh navigation) will serve. `controllerchange` is how the page
 * finds out that swap just happened. */
export function useServiceWorkerUpdate(): boolean {
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    // A controllerchange while this tab never had a controller yet is just
    // the very first activation on a fresh install/first load -- not an
    // update. Only a HANDOFF, while a controller was already driving the
    // page, means a new build won and the loaded bundle is now behind.
    let hadController = !!navigator.serviceWorker.controller
    const onChange = () => {
      if (hadController) setUpdateAvailable(true)
      hadController = true
    }
    navigator.serviceWorker.addEventListener('controllerchange', onChange)
    return () => navigator.serviceWorker.removeEventListener('controllerchange', onChange)
  }, [])

  return updateAvailable
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
