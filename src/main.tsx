import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './App.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Production only — in `npm run dev` this was caching the app shell
// stale-while-revalidate, so a long-running dev tab could sit permanently
// one (or several) refreshes behind every code change, normal reloads
// included. Real offline support only matters for the shipped build.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Register with a relative path so it resolves under GitHub Pages subpaths.
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* first-run environments can silently fail here */
    })
  })
}
