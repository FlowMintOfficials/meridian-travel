/**
 * A hung `fetch()` (dead wifi, captive portal, a server that accepts the
 * connection but never responds) never rejects and never resolves on its
 * own — every caller here was awaiting a plain `fetch()` with no timeout,
 * so a stuck request left `loading` state stuck forever with no retry
 * path (see WeatherPanel). This wraps it with a deadline so callers always
 * get a settled promise.
 */
const DEFAULT_TIMEOUT_MS = 10_000

export async function fetchWithTimeout(
  url: string,
  opts: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal: externalSignal } = opts
  // AbortSignal.timeout/.any are broadly supported in evergreen browsers —
  // Meridian already assumes similarly modern APIs for Web Crypto /
  // IndexedDB, so no feature-detection fallback needed here. Combine an
  // external signal (e.g. a caller cancelling a superseded search-as-you-
  // type request) with our own deadline so either can cancel the request.
  const timeoutSignal = AbortSignal.timeout(timeoutMs)
  const signal =
    externalSignal && typeof AbortSignal.any === 'function'
      ? AbortSignal.any([externalSignal, timeoutSignal])
      : externalSignal ?? timeoutSignal
  try {
    return await fetch(url, { signal })
  } catch (err) {
    if (externalSignal?.aborted) throw err
    if (err instanceof DOMException && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
      throw new Error(`Request timed out after ${timeoutMs}ms: ${url}`)
    }
    throw err
  }
}
