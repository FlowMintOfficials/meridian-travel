import { useEffect, useMemo, useRef, useState, type FormEvent, type RefObject } from 'react'
import { Icon, type IconName } from './Icon'
import { Dialog } from './Dialog'
import { ConfirmDialog } from './ConfirmDialog'
import {
  bytesToText,
  decryptBlob,
  deriveKey,
  encryptBlob,
  fromBase64,
  randomBytes,
  textToBytes,
  toBase64,
} from '../lib/crypto'
import { createVaultLock, verifyVaultLock } from '../lib/vault'
import { makeId } from '../lib/tripHelpers'
import type {
  DocumentKind,
  EmergencyContact,
  EncryptedDocument,
  MeridianData,
  Trip,
} from '../types'
import type { MeridianStore } from '../hooks/useMeridian'

interface DocsTabProps {
  trip: Trip
  data: MeridianData
  store: MeridianStore
  onToast: (text: string, tone?: 'default' | 'success' | 'danger' | 'info') => void
}

const DOC_KINDS: Array<{ id: DocumentKind; label: string; icon: IconName }> = [
  { id: 'passport', label: 'Passport', icon: 'fileText' },
  { id: 'ticket', label: 'Ticket', icon: 'plane' },
  { id: 'insurance', label: 'Insurance', icon: 'shield' },
  { id: 'reservation', label: 'Reservation', icon: 'building' },
  { id: 'visa', label: 'Visa', icon: 'file' },
  { id: 'note', label: 'Note', icon: 'edit' },
  { id: 'other', label: 'Other', icon: 'more' },
]

const CONTACT_KINDS: Array<{
  id: EmergencyContact['kind']
  label: string
  icon: IconName
}> = [
  { id: 'embassy', label: 'Embassy', icon: 'globe' },
  { id: 'insurance', label: 'Insurance', icon: 'shield' },
  { id: 'hospital', label: 'Hospital', icon: 'plus' },
  { id: 'hotel', label: 'Hotel', icon: 'building' },
  { id: 'family', label: 'Family', icon: 'users' },
  { id: 'other', label: 'Other', icon: 'more' },
]

const MAX_FILE_BYTES = 1_400_000

/** Session unlock — key lives in memory only for this tab session. */
let sessionPassphrase: string | null = null

export function DocsTab({ trip, data, store, onToast }: DocsTabProps) {
  const docs = useMemo(
    () => data.documents.filter((d) => d.tripId === trip.id),
    [data.documents, trip.id],
  )
  const contacts = useMemo(
    () => data.emergencyContacts.filter((c) => c.tripId === trip.id),
    [data.emergencyContacts, trip.id],
  )

  const hasLock = Boolean(data.vaultLock)
  const [unlocked, setUnlocked] = useState(() => sessionPassphrase != null)
  const [passphrase, setPassphrase] = useState('')
  const [confirm, setConfirm] = useState('')
  const [hintDraft, setHintDraft] = useState(data.settings.vaultHint ?? '')
  const [unlockError, setUnlockError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const lastActiveRef = useRef(Date.now())

  const [addOpen, setAddOpen] = useState(false)
  const [contactOpen, setContactOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<{
    name: string
    mime: string
    url?: string
    text?: string
  } | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)
  const [pendingDelete, setPendingDelete] = useState<EncryptedDocument | null>(null)

  const handleUnlock = async (e: FormEvent) => {
    e.preventDefault()
    const phrase = passphrase.trim()
    if (phrase.length < 4) {
      setUnlockError('Use at least 4 characters.')
      return
    }

    setVerifying(true)
    setUnlockError(null)
    try {
      if (!data.vaultLock) {
        // First-time setup — create a real encrypted proof.
        if (phrase !== confirm.trim()) {
          setUnlockError('Passphrases do not match.')
          return
        }
        const lock = await createVaultLock(phrase)
        store.setVaultLock(lock)
        if (hintDraft.trim()) {
          store.updateSettings({ vaultHint: hintDraft.trim() })
        }
        sessionPassphrase = phrase
        setUnlocked(true)
        setPassphrase('')
        setConfirm('')
        onToast('Vault passphrase set. Remember it — it cannot be recovered.', 'success')
        return
      }

      const ok = await verifyVaultLock(phrase, data.vaultLock)
      if (!ok) {
        setUnlockError('Wrong passphrase.')
        return
      }
      sessionPassphrase = phrase
      setUnlocked(true)
      setPassphrase('')
      onToast('Vault unlocked for this session.', 'success')
    } catch (err) {
      console.warn('[meridian] vault unlock failed', err)
      setUnlockError('Could not verify passphrase.')
    } finally {
      setVerifying(false)
    }
  }

  const handleLock = () => {
    sessionPassphrase = null
    setUnlocked(false)
    setPreview(null)
    onToast('Vault locked.', 'info')
  }

  // Auto-lock after idle minutes (0 = off). Client-side only.
  useEffect(() => {
    if (!unlocked) return
    const minutes = data.settings.autoLockMinutes
    if (!minutes || minutes <= 0) return

    const bump = () => {
      lastActiveRef.current = Date.now()
    }
    const events: Array<keyof WindowEventMap> = [
      'pointerdown',
      'keydown',
      'touchstart',
      'mousemove',
    ]
    for (const ev of events) window.addEventListener(ev, bump, { passive: true })

    const id = window.setInterval(() => {
      const idleMs = Date.now() - lastActiveRef.current
      if (idleMs >= minutes * 60_000 && sessionPassphrase) {
        sessionPassphrase = null
        setUnlocked(false)
        setPreview(null)
        onToast('Vault auto-locked after idle.', 'info')
      }
    }, 15_000)

    return () => {
      for (const ev of events) window.removeEventListener(ev, bump)
      window.clearInterval(id)
    }
  }, [unlocked, data.settings.autoLockMinutes, onToast])

  const encryptAndStore = async (
    name: string,
    kind: DocumentKind,
    mime: string,
    bytes: Uint8Array,
  ) => {
    if (!sessionPassphrase) throw new Error('Vault is locked')
    if (bytes.byteLength > MAX_FILE_BYTES) {
      throw new Error('File is too large (max ~1.4 MB).')
    }
    const salt = randomBytes(16)
    const key = await deriveKey(sessionPassphrase, salt)
    const { ciphertext, iv } = await encryptBlob(key, bytes)
    const doc: EncryptedDocument = {
      id: makeId('doc'),
      tripId: trip.id,
      name,
      kind,
      mime,
      encryptedData: ciphertext,
      iv,
      salt: toBase64(salt),
      addedAt: new Date().toISOString(),
      size: bytes.byteLength,
    }
    store.addDocument(doc)
  }

  const handleAddFile = async (file: File, kind: DocumentKind) => {
    setBusy(true)
    try {
      const buf = new Uint8Array(await file.arrayBuffer())
      await encryptAndStore(file.name.replace(/\.[^.]+$/, '') || file.name, kind, file.type || 'application/octet-stream', buf)
      onToast(`Encrypted “${file.name}”.`, 'success')
      setAddOpen(false)
    } catch (err) {
      onToast((err as Error).message || 'Could not encrypt file.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  const handleAddNote = async (title: string, body: string) => {
    setBusy(true)
    try {
      await encryptAndStore(title, 'note', 'text/plain', textToBytes(body))
      onToast('Encrypted note saved.', 'success')
      setAddOpen(false)
    } catch (err) {
      onToast((err as Error).message || 'Could not save note.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  const openDocument = async (doc: EncryptedDocument) => {
    if (!sessionPassphrase) {
      onToast('Unlock the vault first.', 'danger')
      return
    }
    setBusy(true)
    try {
      const salt = fromBase64(doc.salt || '')
      if (salt.byteLength === 0) throw new Error('This document is missing its salt.')
      const key = await deriveKey(sessionPassphrase, salt)
      const plain = await decryptBlob(key, doc.encryptedData, doc.iv)
      if (doc.mime.startsWith('text/') || doc.kind === 'note') {
        setPreview({ name: doc.name, mime: doc.mime, text: bytesToText(plain) })
      } else if (doc.mime.startsWith('image/')) {
        const blob = new Blob([new Uint8Array(plain)], { type: doc.mime })
        setPreview({ name: doc.name, mime: doc.mime, url: URL.createObjectURL(blob) })
      } else {
        const blob = new Blob([new Uint8Array(plain)], { type: doc.mime })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = doc.name
        a.click()
        URL.revokeObjectURL(url)
        onToast('File decrypted and downloaded.', 'success')
      }
    } catch {
      onToast('Wrong passphrase or corrupted file.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteDoc = (doc: EncryptedDocument) => setPendingDelete(doc)

  const confirmDeleteDoc = () => {
    if (!pendingDelete) return
    store.deleteDocument(pendingDelete.id)
    setPendingDelete(null)
    onToast('Document removed.', 'info')
  }

  if (!unlocked) {
    const canSubmit = hasLock
      ? passphrase.trim().length >= 4
      : passphrase.trim().length >= 4 && confirm.trim().length >= 4

    return (
      <section className="docs">
        <div className="docs-lock">
          <div className="docs-lock-mark" aria-hidden>
            <Icon name="lock" size={28} />
          </div>
          <h2>{hasLock ? 'Unlock docs vault' : 'Create a vault passphrase'}</h2>
          <p>
            {hasLock
              ? 'Enter the passphrase you set for this device. Wrong codes are rejected.'
              : 'Set a passphrase now. It encrypts every document and must match next time you unlock.'}
          </p>
          <form
            className="docs-unlock-form"
            onSubmit={(e) => {
              void handleUnlock(e)
            }}
          >
            <label className="label">
              <span>{hasLock ? 'Passphrase' : 'Create passphrase'}</span>
              <input
                className="input"
                type="password"
                value={passphrase}
                onChange={(e) => {
                  setPassphrase(e.target.value)
                  setUnlockError(null)
                }}
                placeholder="At least 4 characters"
                autoFocus
                autoComplete={hasLock ? 'current-password' : 'new-password'}
              />
            </label>
            {!hasLock && (
              <>
                <label className="label">
                  <span>Confirm passphrase</span>
                  <input
                    className="input"
                    type="password"
                    value={confirm}
                    onChange={(e) => {
                      setConfirm(e.target.value)
                      setUnlockError(null)
                    }}
                    placeholder="Type it again"
                    autoComplete="new-password"
                  />
                </label>
                <label className="label">
                  <span>Recovery hint (optional, not secret)</span>
                  <input
                    className="input"
                    type="text"
                    value={hintDraft}
                    onChange={(e) => setHintDraft(e.target.value)}
                    placeholder="e.g. childhood street + year"
                    maxLength={80}
                  />
                </label>
              </>
            )}
            {hasLock && data.settings.vaultHint && (
              <p className="docs-hint-chip">
                Hint: <em>{data.settings.vaultHint}</em>
              </p>
            )}
            {unlockError && <p className="docs-error">{unlockError}</p>}
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!canSubmit || verifying}
            >
              <Icon name={hasLock ? 'unlock' : 'shield'} size={14} />
              {verifying
                ? 'Checking…'
                : hasLock
                  ? 'Unlock vault'
                  : 'Set passphrase & unlock'}
            </button>
          </form>
          <p className="docs-lock-hint">
            {hasLock
              ? 'If you forget it, encrypted files on this device cannot be recovered.'
              : 'Write it down somewhere safe. There is no reset without wiping the vault.'}
          </p>
        </div>

        <EmergencySection
          trip={trip}
          contacts={contacts}
          store={store}
          onToast={onToast}
          contactOpen={contactOpen}
          setContactOpen={setContactOpen}
        />
      </section>
    )
  }

  return (
    <section className="docs">
      <div className="vault-strip">
        <header className="vault-strip-head">
          <div className="vault-strip-copy">
            <p className="vault-kicker">
              <span className="vault-live" aria-hidden /> Unlocked
            </p>
            <h3 className="vault-title">
              {docs.length === 0 ? 'Empty vault' : `${docs.length} encrypted`}
            </h3>
            <p className="vault-sub">
              {docs.length === 0
                ? 'Files stay sealed until you open them with your passphrase.'
                : 'Tap a file to decrypt · Lock when you’re done'}
            </p>
          </div>
          <div className="vault-strip-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleLock}
              title="Lock vault"
            >
              <Icon name="lock" size={14} /> Lock
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setAddOpen(true)}
              disabled={busy}
            >
              <Icon name="plus" size={14} /> Add
            </button>
          </div>
        </header>

        {docs.length === 0 ? (
          <button type="button" className="vault-empty" onClick={() => setAddOpen(true)}>
            <Icon name="fileText" size={20} />
            <span>
              <strong>Add a passport, ticket, or note</strong>
              <small>Encrypted on this device before it is stored.</small>
            </span>
          </button>
        ) : (
          <ul className="vault-files">
            {docs.map((doc) => {
              const meta =
                DOC_KINDS.find((k) => k.id === doc.kind) ?? DOC_KINDS[DOC_KINDS.length - 1]
              return (
                <li key={doc.id} className={`vault-file kind-${doc.kind}`}>
                  <button
                    type="button"
                    className="vault-file-open"
                    onClick={() => void openDocument(doc)}
                    disabled={busy}
                  >
                    <span className="vault-file-kind">{meta.label}</span>
                    <strong className="vault-file-name">{doc.name}</strong>
                    <span className="vault-file-meta mono">
                      {formatBytes(doc.size)}
                      <span aria-hidden>·</span>
                      {new Date(doc.addedAt).toLocaleDateString()}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="vault-file-delete"
                    onClick={() => handleDeleteDoc(doc)}
                    aria-label={`Delete ${doc.name}`}
                  >
                    <Icon name="trash" size={13} />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <EmergencySection
        trip={trip}
        contacts={contacts}
        store={store}
        onToast={onToast}
        contactOpen={contactOpen}
        setContactOpen={setContactOpen}
      />

      {addOpen && (
        <AddDocDialog
          open
          busy={busy}
          fileRef={fileRef}
          onClose={() => setAddOpen(false)}
          onFile={(file, kind) => void handleAddFile(file, kind)}
          onNote={(title, body) => void handleAddNote(title, body)}
        />
      )}

      {preview && (
        <Dialog
          open
          onClose={() => {
            if (preview.url) URL.revokeObjectURL(preview.url)
            setPreview(null)
          }}
          title={preview.name}
          size="md"
          footer={
            <div className="dialog-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  if (preview.url) URL.revokeObjectURL(preview.url)
                  setPreview(null)
                }}
              >
                Close
              </button>
            </div>
          }
        >
          {preview.url ? (
            <img src={preview.url} alt={preview.name} className="docs-preview-img" />
          ) : (
            <pre className="docs-preview-text">{preview.text}</pre>
          )}
        </Dialog>
      )}

      <ConfirmDialog
        open={pendingDelete != null}
        tone="danger"
        icon="trash"
        title="Delete this document?"
        description={
          <>
            Delete <strong>{pendingDelete?.name}</strong> from the vault.{' '}
            <strong>This cannot be undone.</strong>
          </>
        }
        confirmLabel="Delete"
        onConfirm={confirmDeleteDoc}
        onClose={() => setPendingDelete(null)}
      />
    </section>
  )
}

// -------------------------------------------------------------------

function EmergencySection({
  trip,
  contacts,
  store,
  onToast,
  contactOpen,
  setContactOpen,
}: {
  trip: Trip
  contacts: EmergencyContact[]
  store: MeridianStore
  onToast: DocsTabProps['onToast']
  contactOpen: boolean
  setContactOpen: (v: boolean) => void
}) {
  const [label, setLabel] = useState('')
  const [detail, setDetail] = useState('')
  const [kind, setKind] = useState<EmergencyContact['kind']>('family')

  const handleAdd = (e: FormEvent) => {
    e.preventDefault()
    if (!label.trim() || !detail.trim()) return
    store.addEmergencyContact(trip.id, { label: label.trim(), detail: detail.trim(), kind })
    onToast('Emergency contact added.', 'success')
    setLabel('')
    setDetail('')
    setContactOpen(false)
  }

  const dest =
    trip.destinations.map((d) => d.city).join(' · ') || trip.name

  return (
    <div className="docs-emergency" id="emergency-print">
      <div className="emg-strip">
        <header className="emg-strip-head">
          <div className="emg-strip-copy">
            <p className="emg-kicker">In case of emergency</p>
            <h3 className="emg-title">{dest}</h3>
            <p className="emg-sub">{trip.name}</p>
          </div>
          <div className="emg-strip-actions no-print">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => window.print()}
              title="Print wallet card"
            >
              <Icon name="print" size={14} />
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setContactOpen(true)}>
              <Icon name="plus" size={14} /> Add
            </button>
          </div>
        </header>

        {contacts.length === 0 ? (
          <button
            type="button"
            className="emg-empty no-print"
            onClick={() => setContactOpen(true)}
          >
            <Icon name="users" size={18} />
            <span>
              <strong>No contacts yet</strong>
              <small>Add family, hotel, embassy, or insurance — big numbers, one glance.</small>
            </span>
          </button>
        ) : (
          <ul className="emg-rows">
            {contacts.map((c) => {
              const meta =
                CONTACT_KINDS.find((k) => k.id === c.kind) ?? CONTACT_KINDS[CONTACT_KINDS.length - 1]
              const tel = c.detail.replace(/[^\d+]/g, '')
              const canCall = /^\+?\d{6,}$/.test(tel)
              return (
                <li key={c.id} className={`emg-row kind-${c.kind}`}>
                  <span className="emg-row-rail" aria-hidden />
                  <div className="emg-row-body">
                    <span className="emg-row-kind">
                      <Icon name={meta.icon} size={12} /> {meta.label}
                    </span>
                    <strong className="emg-row-name">{c.label}</strong>
                    {canCall ? (
                      <a className="emg-row-phone mono" href={`tel:${tel}`}>
                        {c.detail}
                      </a>
                    ) : (
                      <span className="emg-row-phone mono">{c.detail}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="emg-row-delete no-print"
                    onClick={() => {
                      store.deleteEmergencyContact(c.id)
                      onToast('Contact removed.', 'info')
                    }}
                    aria-label={`Remove ${c.label}`}
                  >
                    <Icon name="trash" size={13} />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {contactOpen && (
        <Dialog
          open
          onClose={() => setContactOpen(false)}
          title="Add emergency contact"
          size="sm"
          footer={
            <div className="dialog-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setContactOpen(false)}>
                Cancel
              </button>
              <button
                type="submit"
                form="emg-form"
                className="btn btn-primary"
                disabled={!label.trim() || !detail.trim()}
              >
                Add
              </button>
            </div>
          }
        >
          <form id="emg-form" onSubmit={handleAdd} className="trip-form">
            <div className="label">
              <span>Type</span>
              <div className="type-chips type-chips-compact">
                {CONTACT_KINDS.map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    className={`type-chip ${kind === k.id ? 'active' : ''}`}
                    onClick={() => setKind(k.id)}
                  >
                    <Icon name={k.icon} size={13} />
                    <span className="type-chip-label">{k.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <label className="label">
              <span>Name</span>
              <input
                className="input"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Travel insurance hotline"
                autoFocus
                required
              />
            </label>
            <label className="label">
              <span>Phone / detail</span>
              <input
                className="input"
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder="+34 … or policy number"
                required
              />
            </label>
          </form>
        </Dialog>
      )}
    </div>
  )
}

// -------------------------------------------------------------------

function AddDocDialog({
  open,
  busy,
  fileRef,
  onClose,
  onFile,
  onNote,
}: {
  open: boolean
  busy: boolean
  fileRef: RefObject<HTMLInputElement | null>
  onClose: () => void
  onFile: (file: File, kind: DocumentKind) => void
  onNote: (title: string, body: string) => void
}) {
  const [mode, setMode] = useState<'file' | 'note'>('file')
  const [kind, setKind] = useState<DocumentKind>('passport')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add to vault"
      subtitle="Files and notes are encrypted before saving."
      size="md"
      footer={
        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          {mode === 'note' ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || !title.trim() || !body.trim()}
              onClick={() => onNote(title.trim(), body.trim())}
            >
              Encrypt & save
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              <Icon name="upload" size={14} /> Choose file
            </button>
          )}
        </div>
      }
    >
      <div className="trip-form">
        <div className="seg docs-mode-seg">
          <button
            type="button"
            className={mode === 'file' ? 'active' : ''}
            onClick={() => setMode('file')}
          >
            File
          </button>
          <button
            type="button"
            className={mode === 'note' ? 'active' : ''}
            onClick={() => setMode('note')}
          >
            Note
          </button>
        </div>

        {mode === 'file' ? (
          <>
            <div className="label">
              <span>Kind</span>
              <div className="type-chips type-chips-compact">
                {DOC_KINDS.filter((k) => k.id !== 'note').map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    className={`type-chip ${kind === k.id ? 'active' : ''}`}
                    onClick={() => setKind(k.id)}
                  >
                    <Icon name={k.icon} size={13} />
                    <span className="type-chip-label">{k.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <p className="docs-lock-hint">Images and PDFs up to ~1.4 MB. Encrypted locally.</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.pdf,.txt,.png,.jpg,.jpeg,.webp"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) onFile(file, kind)
                e.target.value = ''
              }}
            />
          </>
        ) : (
          <>
            <label className="label">
              <span>Title</span>
              <input
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Airbnb door code"
                autoFocus
              />
            </label>
            <label className="label">
              <span>Note</span>
              <textarea
                className="textarea"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write anything sensitive…"
                rows={4}
              />
            </label>
          </>
        )}
      </div>
    </Dialog>
  )
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}
