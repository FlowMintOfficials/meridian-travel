# Meridian

**A private, offline-first travel companion.**
Plan trips, generate smart weather-aware packing lists, build day-by-day itineraries, track multi-currency expenses, split costs with travelers, and vault your travel documents — all on your device, no accounts, no cloud, no telemetry.

Live at your own GitHub Pages URL — see [Deployment](#deployment) below.

---

## Highlights

- **Trips dashboard** with a hero card for whatever trip is happening now or coming up next, phase filters (Now / Upcoming / Past / Archived), countdown chips, and a card grid for everything else.
- **Create & edit trip flow** — name, type (8 trip-type chips), live destination search (Open-Meteo geocoding) with automatic country → currency inference, dates, home/trip currency, traveler roster, budget target, timezone, and notes. Every field stays editable after creation, from a dedicated toolbar button or the trip's action menu.
- **Packing** with 8 built-in weather-aware templates auto-seeded on trip creation, essentials, quantities, skip/reset/clear, save-as-template, and a card-grid layout that flags essentials with an amber outline and tints packed items green.
- **Pre-trip checklist** — a starter list (bookings, visas, insurance, SIMs, …) you can check off, skip, or extend, in the same card-grid treatment as packing.
- **Itinerary** with a day-by-day timeline, 8 event types (flight, train, transport, lodging, food, activity, landmark, note), times/addresses/booking refs/costs, flight- and train-specific fields (carrier, terminal, gate, seat), local-timezone display, and a print-friendly stylesheet.
- **Expenses** logged in any currency and auto-converted to your home currency using cached ECB rates from [frankfurter.app](https://www.frankfurter.app), with a category breakdown, running daily average, budget progress, and a "Settle up" bill-split view for group trips.
- **Photo journal** — a per-day photo log for each trip; images are stored as blobs in IndexedDB (kept out of JSON backups by design) with captions and delete/undo.
- **Encrypted document vault** — a passphrase-gated space (AES-GCM, PBKDF2 key derivation) for passports, tickets, insurance, visas, and notes, with configurable auto-lock, plus an independent emergency-contacts card with a print-friendly wallet layout.
- **Trip summaries** — download a self-contained HTML report or open the print dialog to save as PDF, covering budget, itinerary, packing, and documents.
- **Live weather** forecast for the top destination via [open-meteo.com](https://open-meteo.com), driving packing suggestions.
- **Backup & restore** the entire dataset as a single JSON file; import merges by id rather than clobbering. Destructive actions (import, wipe, delete) go through in-app confirmation dialogs — no native browser popups.
- **PWA-ready** — service worker, manifest, installable, works offline. The service worker only registers in production builds, so local development never fights a stale cache.
- **Ocean-horizon design system** — a true-black base with a teal-to-sky accent gradient, Sora for display type, Figtree for body text, IBM Plex Mono for numerics.

---

## Stack

- Vite 8 + React 19 + TypeScript
- Zero UI dependencies — every component is hand-built
- Web Crypto API for AES-GCM document encryption (PBKDF2 key derivation)
- `localStorage` for the main data store (schema-normalized on every load, so older or hand-edited data can't crash the app), IndexedDB for photo blobs

Build output is roughly **~356 KB / ~103 KB gzipped** for JS and **~62 KB / ~11 KB gzipped** for CSS.

---

## Getting started

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # production build in ./dist
npm run lint      # oxlint
npm run preview   # preview the built dist
```

Node 20+ recommended.

---

## Deployment

### Option A — GitHub Pages (automated)

1. Create a new GitHub repo and push this project.
2. In your repo, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Push to `main`. The workflow at [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml) will build and publish `dist/` on every push.
4. Meridian is served under a subpath, e.g. `https://<user>.github.io/<repo>/` — this works out of the box because `vite.config.ts` sets `base: './'` (relative paths).

### Option B — GitHub Pages (manual copy-paste)

1. `npm run build`
2. Copy every file inside `dist/` into your `gh-pages` branch (or wherever your Pages source points).
3. Commit and push.

### Option C — any static host

The contents of `dist/` are a fully static site. Drop them into:
- Netlify (drag & drop)
- Cloudflare Pages
- Vercel (static preset)
- S3 + CloudFront
- A plain nginx/Apache server

No environment variables, no build-time secrets, no server needed.

---

## Privacy

Meridian does not send your trip data anywhere.

Two outbound requests happen from your browser, both to public APIs and both cached aggressively:

| API | Purpose | Data sent |
| --- | --- | --- |
| [frankfurter.app](https://www.frankfurter.app) | Currency conversion (ECB reference rates) | your home currency code (e.g. `USD`) |
| [open-meteo.com](https://open-meteo.com) | Forecast + geocoding | search query + lat/long |

Both use HTTPS and neither requires an API key. If you go fully offline after your first successful load, cached rates and forecasts continue to work.

The encrypted-documents vault (passport scans, boarding passes, notes) uses AES-GCM with PBKDF2-derived keys — the passphrase never leaves your device, and only a verifier (not the key itself) is stored.

---

## Project layout

```
meridian/
├─ public/               static assets, manifest, service worker
├─ src/
│  ├─ components/        React components (TripCard, TripDetail, PackingTab, ConfirmDialog, …)
│  ├─ hooks/             useMeridian — the single source of truth
│  ├─ lib/               storage, crypto, currency, weather, templates, photos, helpers
│  ├─ styles/            modular CSS (shell, trips, packing, itinerary, expenses, forms, docs)
│  ├─ App.css            design tokens (palette, fonts, spacing)
│  ├─ App.tsx            top-level layout + view routing
│  ├─ main.tsx           entry point + service worker registration (production only)
│  └─ types.ts           all shared TypeScript interfaces
├─ index.html
├─ vite.config.ts
└─ package.json
```

---

## Data model

Everything except photo blobs lives in one JSON object in `localStorage` under the key `meridian:data:v1`. Backing it up is exactly `Settings → Export backup`. Restoring is `Settings → Import backup` — both go through the same normalization that backfills anything missing so an older or hand-edited backup can't crash the app.

The top-level shape (see [`src/types.ts`](./src/types.ts)):

```ts
interface MeridianData {
  version: 1
  trips: Trip[]
  packing: PackingItem[]
  itinerary: ItineraryEvent[]
  expenses: Expense[]
  checklist: ChecklistItem[]
  photos: TripPhoto[]                   // metadata only — image bytes live in IndexedDB
  documents: EncryptedDocument[]        // AES-GCM encrypted content, inline
  emergencyContacts: EmergencyContact[]
  customTemplates: PackingTemplate[]
  settings: Settings
  vaultLock?: VaultLock
  cachedRates?: CachedCurrencyRates
  cachedWeather: CachedWeather[]
}
```

Records are keyed by `id`, so imports **merge** rather than clobber — you can import a backup from another device and everything reconciles. Photo image data is intentionally excluded from the JSON export (it lives in IndexedDB) to keep backups small and portable.

---

## Roadmap

Already shipped:

- [x] Trips dashboard, create flow with geocoding, and full post-creation editing
- [x] Weather-aware packing with 8 built-in templates, card-grid layout
- [x] Pre-trip checklist
- [x] Itinerary timeline with print-to-PDF
- [x] Multi-currency expenses with live cached rates and bill-splitting
- [x] Photo journal
- [x] Encrypted document vault + emergency contacts wallet card
- [x] Backup / restore / wipe, with in-app confirmation dialogs
- [x] PWA install + offline, service worker gated to production builds

Not yet:

- [ ] Browsing/applying saved custom packing templates (saving one works; nothing lets you pick it for a new trip yet)
- [ ] Reconciling traveler count with the traveler-names list (bill-split and "paid by" key off names, not the count)
- [ ] Calendar (`.ics`) export for itinerary events
- [ ] Receipt photos attached to individual expenses
- [ ] Multi-device sync without a cloud account

---

## License

MIT — do whatever you like.
