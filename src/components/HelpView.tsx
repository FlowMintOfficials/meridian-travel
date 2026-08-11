import { useMemo, useState } from 'react'
import { Icon, type IconName } from './Icon'
import { EmptyState } from './EmptyState'

interface HelpTopic {
  id: string
  icon: IconName
  title: string
  summary: string
  tips: string[]
}

const TOPICS: HelpTopic[] = [
  {
    id: 'trips',
    icon: 'compass',
    title: 'Trips',
    summary: 'Create, edit, and organize every journey.',
    tips: [
      'Tap "New trip" and fill in what you know — only a name and dates are required, everything else can wait.',
      'Use the pencil icon (or the ⋯ menu) inside a trip to edit any detail later, including destinations, travelers, and currencies.',
      'The Now / Upcoming / Past / Archived filters at the top of Trips help you find what you need fast. Trips that are all happening "right now" get equal billing at the top — nothing is arbitrarily picked over another.',
      'Switch between grid and list view for "All trips" with the toggle next to Import — your choice is remembered.',
      'The sidebar shows your most relevant trips inline, so switching trips never means detouring through this list first.',
      'Duplicate a trip to reuse its packing list and itinerary for a repeat visit — expenses are left out so budgets don’t carry over.',
      'Archiving hides a trip from the main list without deleting anything; Delete is the only action that’s permanent.',
      'On a trip’s Overview tab: log a travel insurance policy (provider, policy number, a tap-to-call emergency line) and a per-destination "entry requirements" link — a live search, not a stored answer, since visa rules depend on your nationality and change often.',
    ],
  },
  {
    id: 'checklist',
    icon: 'check',
    title: 'Pre-trip checklist',
    summary: 'Bookings, visas, insurance — everything before you leave.',
    tips: [
      '"Add starter list" seeds ten common pre-trip tasks — check them off, skip what doesn’t apply, or add your own.',
      'Skipped items stay visible but faded, so you can see at a glance what you deliberately chose not to do.',
    ],
  },
  {
    id: 'packing',
    icon: 'suitcase',
    title: 'Packing',
    summary: 'Weather-aware lists that adjust to where you’re going.',
    tips: [
      '"Smart start" builds a list from a built-in template for your trip type, filtered by the destination’s forecast.',
      'Star an item to mark it essential — essential items get a gold outline so they stand out in the list.',
      'Save your current list as a custom template from the ⋯ menu to reuse it on a future trip.',
      'Reset checkboxes clears progress without removing items; Clear all items deletes the whole list — that one asks you to confirm first.',
    ],
  },
  {
    id: 'itinerary',
    icon: 'map',
    title: 'Itinerary',
    summary: 'A day-by-day timeline for flights, stays, and plans.',
    tips: [
      'Quick add just needs a title — add times, locations, costs, and booking references later if you want them.',
      'Flights and trains get their own fields: carrier, terminal, gate, and seat.',
      'Add a flight or train number and a "Track flight/train" link appears, opening a live public tracker (or a status search, for trains) in a new tab.',
      'Times shown use the trip’s timezone if you set one when creating or editing the trip.',
      'Use Print from the Itinerary tab for a clean paper copy at the airport.',
    ],
  },
  {
    id: 'toolkit',
    icon: 'plug',
    title: 'Toolkit',
    summary: 'On-the-ground reference for wherever you land.',
    tips: [
      'Plug type, voltage, and frequency for the destination — bundled for ~50 common countries since this basically never changes.',
      'Tipping & etiquette norms for restaurants, taxis, and hotels — general guidance, since customs vary by venue even within one country.',
      'A jet-lag planner compares the trip’s timezone to your device’s and suggests a gradual sleep-shift schedule.',
      'A quick unit converter for distance, weight, temperature, volume, and length.',
      'No data on file for a destination? A "Search →" link opens the right lookup instead of a dead end.',
    ],
  },
  {
    id: 'expenses',
    icon: 'wallet',
    title: 'Expenses',
    summary: 'Multi-currency spending, budgets, and splitting costs.',
    tips: [
      'Log an expense in whatever currency you paid in — Meridian converts it to your home currency automatically using cached exchange rates.',
      'Tap the small image icon on any logged expense to attach a receipt photo — stored on this device the same way trip photos are, and removable any time.',
      'Set a budget target to see a progress bar and an over-budget warning as you log spending.',
      '"Settle up" appears once a trip has two or more named travelers, showing who owes whom based on who paid for what.',
      'Currency rates need one successful online check to cache; after that, conversions keep working offline for a while.',
      'Settings has a cross-trip spending overview — every trip’s expenses in one currency, broken down by category and by month.',
    ],
  },
  {
    id: 'photos',
    icon: 'image',
    title: 'Photos',
    summary: 'A day-by-day photo journal for the trip.',
    tips: [
      'Photos are grouped by day and stored as image files directly in this browser — they’re not included in JSON backups, so export them separately if you switch devices.',
      'Add a caption to remember the moment. Delete shows an Undo option for a few seconds in case you tap the wrong one.',
    ],
  },
  {
    id: 'docs',
    icon: 'lock',
    title: 'Document vault',
    summary: 'Encrypted passports, tickets, and notes — plus emergency contacts.',
    tips: [
      'The first time you open Docs, you’ll set a passphrase. It encrypts everything in the vault and cannot be recovered if you forget it — write it down somewhere safe.',
      'Add scanned files (images, PDFs, text) or quick encrypted notes.',
      'Auto-lock, set in Settings, locks the vault again after a period of inactivity.',
      'Emergency contacts live outside the vault lock, so embassy or insurance numbers stay visible even when Docs is locked — with a print-friendly wallet card.',
    ],
  },
  {
    id: 'loyalty',
    icon: 'starFilled',
    title: 'Loyalty, subscriptions & spending',
    summary: 'The travel stuff that spans every trip, not just one.',
    tips: [
      'Settings → Loyalty & rewards tracks airline, hotel, rail, and car-rental membership numbers — separate from any one trip, since they apply across all of them.',
      'Settings → Travel subscriptions tracks recurring costs like lounge memberships or annual insurance, with a due-date chip that flags what’s overdue or coming up.',
      'Settings → Spending overview rolls up every trip’s expenses into one currency, by category and by month, for the bigger picture beyond a single trip’s budget.',
    ],
  },
  {
    id: 'backup',
    icon: 'shield',
    title: 'Backup & privacy',
    summary: 'Everything stays on this device unless you export it.',
    tips: [
      'Meridian has no accounts and no cloud sync. The only things it ever sends out are currency and weather lookups, and — only if you tap them — a destination-search or flight-number link in the Toolkit or Itinerary tabs. Your trip data itself is never uploaded.',
      'Export a backup from Settings regularly. Clearing your browser data or switching devices without one means starting over.',
      'Import merges by matching IDs, so importing an old backup adds or updates items without wiping what’s already there.',
      'Erase everything requires typing a confirmation phrase first — there’s no accidental one-click wipe.',
    ],
  },
]

const FAQ: { q: string; a: string }[] = [
  {
    q: 'Where is my data stored?',
    a: 'Entirely on this device, in your browser’s local storage (and IndexedDB for photos). Nothing is uploaded anywhere.',
  },
  {
    q: 'What happens if I clear my browser data?',
    a: 'Everything in Meridian is erased along with it. Export a backup from Settings before clearing site data or switching browsers.',
  },
  {
    q: 'Can I use Meridian on more than one device?',
    a: 'Yes — export a backup on one device and import it on another. Photos live in IndexedDB and aren’t included, so move those separately if you need them.',
  },
  {
    q: 'I forgot my document vault passphrase — can I recover it?',
    a: 'No. The passphrase never leaves your device and isn’t stored anywhere, so there’s no reset. You’d need to erase and re-add the vault’s contents.',
  },
  {
    q: 'Does Meridian work without an internet connection?',
    a: 'Yes, once installed as an app (Settings → Install). Currency rates and weather need one successful online fetch to cache; after that they keep working offline until the cache goes stale.',
  },
  {
    q: 'Does Meridian know my visa or entry requirements?',
    a: 'No, on purpose. Requirements depend on your nationality, which Meridian doesn’t collect, and they change often enough that a bundled answer could be confidently wrong. The Overview tab’s entry-requirements card links to a live search per destination instead of guessing.',
  },
  {
    q: 'Does Meridian track my flight in real time?',
    a: 'No — there’s no embedded flight-data API (that would need an account/API key, working against the no-accounts design). The Itinerary tab’s "Track flight/train" link opens a public tracker in a new tab instead.',
  },
]

export function HelpView() {
  const [query, setQuery] = useState('')
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set(['trips']))

  const q = query.trim().toLowerCase()

  const filteredTopics = useMemo(() => {
    if (!q) return TOPICS
    return TOPICS.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.summary.toLowerCase().includes(q) ||
        t.tips.some((tip) => tip.toLowerCase().includes(q)),
    )
  }, [q])

  const filteredFaq = useMemo(() => {
    if (!q) return FAQ
    return FAQ.filter((f) => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q))
  }, [q])

  const toggleTopic = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const noResults = q.length > 0 && filteredTopics.length === 0 && filteredFaq.length === 0

  return (
    <div className="view">
      <div className="view-lead">
        <p className="eyebrow">Help</p>
        <h1>Guide &amp; FAQ.</h1>
        <p>
          Everything Meridian can do, and a few answers for the "wait, where's my data?"
          moments.
        </p>
      </div>

      <label className="help-search">
        <Icon name="search" size={15} />
        <input
          type="text"
          className="help-search-input"
          placeholder="Search the guide — try “passphrase” or “budget”…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      {!q && (
        <div className="help-quickstart">
          <p className="help-eyebrow">
            <Icon name="sparkle" size={13} /> Quick start
          </p>
          <ol className="help-steps">
            <li>
              <strong>Create a trip.</strong> A name and dates are all you need to start.
            </li>
            <li>
              <strong>Pack smart.</strong> Use Smart start for a weather-aware list, or build
              your own.
            </li>
            <li>
              <strong>Plan your days.</strong> Add flights, stays, and plans to the Itinerary
              tab.
            </li>
            <li>
              <strong>Track spending.</strong> Log expenses in any currency as you go.
            </li>
            <li>
              <strong>Wrap up.</strong> Mark the trip Complete to unlock a downloadable
              summary.
            </li>
          </ol>
        </div>
      )}

      {noResults ? (
        <EmptyState
          icon="search"
          title="Nothing found"
          description={`No help topics or FAQ match "${query}".`}
        />
      ) : (
        <>
          <div className="help-topics">
            {filteredTopics.map((topic) => {
              const open = q.length > 0 || openIds.has(topic.id)
              return (
                <div key={topic.id} className={`help-topic ${open ? 'open' : ''}`}>
                  <button
                    type="button"
                    className="help-topic-head"
                    onClick={() => toggleTopic(topic.id)}
                    aria-expanded={open}
                  >
                    <span className="settings-icon">
                      <Icon name={topic.icon} size={16} />
                    </span>
                    <span className="help-topic-title">
                      <strong>{topic.title}</strong>
                      <small>{topic.summary}</small>
                    </span>
                    <Icon name="chevronDown" size={16} className="help-topic-chevron" />
                  </button>
                  {open && (
                    <ul className="help-topic-body">
                      {topic.tips.map((tip, i) => (
                        <li key={i}>{tip}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>

          {filteredFaq.length > 0 && (
            <div className="help-faq">
              <p className="help-eyebrow">
                <Icon name="info" size={13} /> Frequently asked
              </p>
              <div className="help-faq-list">
                {filteredFaq.map((f) => (
                  <details key={f.q} className="help-faq-item" open={q.length > 0}>
                    <summary>{f.q}</summary>
                    <p>{f.a}</p>
                  </details>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
