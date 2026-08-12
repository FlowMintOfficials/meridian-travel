import { useEffect, useRef, useState } from 'react'
import { Dialog } from './Dialog'
import { Icon } from './Icon'
import { QrCode } from './QrCode'
import {
  applySyncAnswer,
  buildTripSyncPayload,
  closeSyncSession,
  createSyncAnswer,
  createSyncOffer,
  isTripSyncPayload,
  peerSyncSupported,
  receiveJson,
  sendJson,
  waitForChannelOpen,
  type SyncSession,
} from '../lib/peerSync'
import type { MeridianData, Trip } from '../types'
import type { MeridianStore } from '../hooks/useMeridian'
import type { ToastFn } from './Toast'

interface PeerSyncDialogProps {
  trip: Trip
  data: MeridianData
  store: MeridianStore
  onClose: () => void
  onToast: ToastFn
}

type Stage =
  | 'idle'
  | 'hosting' // showing our offer code, waiting for their answer to be pasted in
  | 'joining-input' // waiting for the host's offer code to be pasted in
  | 'joining-code' // showing our answer code, waiting for the connection
  | 'connecting' // trying to establish the data channel — NOT yet connected
  | 'syncing' // channel open, exchanging data
  | 'done'
  | 'error'

export function PeerSyncDialog({ trip, data, store, onClose, onToast }: PeerSyncDialogProps) {
  const [stage, setStage] = useState<Stage>('idle')
  const [myCode, setMyCode] = useState('')
  const [pastedCode, setPastedCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [added, setAdded] = useState(0)
  const [copied, setCopied] = useState(false)
  // Covers the gaps the stage machine doesn't otherwise narrate: offer/
  // answer generation both wait on ICE candidate gathering (up to a few
  // seconds), and with no stage change to show for it, the buttons that
  // trigger them just sat there looking unclicked. This flags exactly
  // those windows so the button itself can say so.
  const [busy, setBusy] = useState(false)
  const sessionRef = useRef<SyncSession | null>(null)
  const supported = peerSyncSupported()

  // Whichever stage we're in when the dialog goes away — closed manually,
  // or the component unmounts — never leave a connection dangling.
  useEffect(() => {
    return () => closeSyncSession(sessionRef.current)
  }, [])

  const fail = (err: unknown, fallback: string) => {
    setError(err instanceof Error && err.message ? err.message : fallback)
    setStage('error')
  }

  // Once the channel is open on either side, the exchange itself is
  // symmetric: send our copy of this trip, wait for theirs, merge it in.
  const runExchange = async (session: SyncSession) => {
    setStage('connecting')
    const channel = await waitForChannelOpen(session)
    setStage('syncing')
    sendJson(channel, buildTripSyncPayload(trip, data))
    const incoming = await receiveJson(channel)
    if (!isTripSyncPayload(incoming)) {
      throw new Error('Received unexpected data from the other device.')
    }
    const count = store.mergeTripSyncData(incoming)
    closeSyncSession(session)
    sessionRef.current = null
    setAdded(count)
    setStage('done')
    onToast(`Synced "${trip.name}" with the other device.`, 'success')
  }

  const handleStartHost = async () => {
    setError(null)
    setBusy(true)
    try {
      const { session, code } = await createSyncOffer()
      sessionRef.current = session
      setMyCode(code)
      setStage('hosting')
    } catch (err) {
      fail(err, 'Could not start pairing — this browser may not support it.')
    } finally {
      setBusy(false)
    }
  }

  const handleSubmitAnswer = async () => {
    const session = sessionRef.current
    if (!session) return
    setError(null)
    setBusy(true)
    try {
      await applySyncAnswer(session, pastedCode)
      await runExchange(session)
    } catch (err) {
      fail(err, 'Pairing failed.')
    } finally {
      setBusy(false)
    }
  }

  const handleSubmitOffer = async () => {
    setError(null)
    setBusy(true)
    try {
      const { session, code } = await createSyncAnswer(pastedCode)
      sessionRef.current = session
      setMyCode(code)
      setStage('joining-code')
      // The host still has to apply our answer on their end before the
      // connection actually completes — nothing more to do here but wait.
      runExchange(session).catch((err) => fail(err, 'Pairing failed.'))
    } catch (err) {
      fail(err, 'That code didn’t look right.')
    } finally {
      setBusy(false)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(myCode)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API unavailable/denied — the code is still selectable
      // in the textarea below.
    }
  }

  const handleClose = () => {
    closeSyncSession(sessionRef.current)
    sessionRef.current = null
    onClose()
  }

  const reset = () => {
    closeSyncSession(sessionRef.current)
    sessionRef.current = null
    setMyCode('')
    setPastedCode('')
    setError(null)
    setStage('idle')
  }

  return (
    <Dialog
      open
      onClose={handleClose}
      title="Sync with another device"
      subtitle="Direct device-to-device — no server, no account. Both devices need this dialog open."
      size="md"
      footer={
        <div className="dialog-actions">
          {stage === 'error' ? (
            <>
              <button type="button" className="btn btn-ghost" onClick={handleClose}>
                Close
              </button>
              <button type="button" className="btn btn-primary" onClick={reset}>
                <Icon name="refresh" size={14} /> Try again
              </button>
            </>
          ) : stage === 'done' ? (
            <button type="button" className="btn btn-primary" onClick={handleClose}>
              Done
            </button>
          ) : (
            <button type="button" className="btn btn-ghost" onClick={handleClose}>
              Cancel
            </button>
          )}
        </div>
      }
    >
      {!supported ? (
        <p className="docs-error">
          This browser doesn’t support the WebRTC APIs this needs. Try a recent Chrome, Edge,
          Firefox, or Safari.
        </p>
      ) : (
        <div className="peer-sync">
          {stage === 'idle' && (
            <div className="peer-sync-choice">
              <button
                type="button"
                className="peer-sync-option"
                onClick={() => void handleStartHost()}
                disabled={busy}
              >
                <Icon name="qr" size={20} />
                <strong>{busy ? 'Generating code…' : 'Start pairing'}</strong>
                <span>
                  {busy ? (
                    <>
                      <span className="peer-sync-spinner" aria-hidden /> This can take a few
                      seconds — please wait.
                    </>
                  ) : (
                    'Generate a code for the other device to scan or paste.'
                  )}
                </span>
              </button>
              <button
                type="button"
                className="peer-sync-option"
                onClick={() => setStage('joining-input')}
                disabled={busy}
              >
                <Icon name="upload" size={20} />
                <strong>I have a code</strong>
                <span>The other device already started and showed you a code.</span>
              </button>
            </div>
          )}

          {stage === 'hosting' && (
            <div className="peer-sync-step">
              <p className="peer-sync-hint">
                <Icon name="info" size={13} /> Show this to the other device, or send the text
                code below.
              </p>
              <div className="peer-sync-qr">
                <QrCode data={myCode} size={200} />
              </div>
              <div className="peer-sync-code-row">
                <textarea className="textarea mono" readOnly rows={3} value={myCode} />
                <button type="button" className="btn btn-ghost btn-icon" onClick={() => void handleCopy()}>
                  <Icon name={copied ? 'check' : 'copy'} size={14} />
                </button>
              </div>
              <label className="label">
                <span>Then paste their answer code here</span>
                <textarea
                  className="textarea mono"
                  rows={3}
                  value={pastedCode}
                  onChange={(e) => {
                    setPastedCode(e.target.value)
                    setError(null)
                  }}
                  placeholder="Paste the code they send back…"
                />
              </label>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!pastedCode.trim() || busy}
                onClick={() => void handleSubmitAnswer()}
              >
                {busy ? (
                  <>
                    <span className="peer-sync-spinner" aria-hidden /> Connecting — please wait…
                  </>
                ) : (
                  <>
                    <Icon name="check" size={14} /> Connect
                  </>
                )}
              </button>
            </div>
          )}

          {stage === 'joining-input' && (
            <div className="peer-sync-step">
              <label className="label">
                <span>Paste the code from the other device</span>
                <textarea
                  className="textarea mono"
                  rows={3}
                  value={pastedCode}
                  onChange={(e) => {
                    setPastedCode(e.target.value)
                    setError(null)
                  }}
                  placeholder="Paste their pairing code…"
                  autoFocus
                />
              </label>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!pastedCode.trim() || busy}
                onClick={() => void handleSubmitOffer()}
              >
                {busy ? (
                  <>
                    <span className="peer-sync-spinner" aria-hidden /> Generating code — please
                    wait…
                  </>
                ) : (
                  'Continue'
                )}
              </button>
            </div>
          )}

          {stage === 'joining-code' && (
            <div className="peer-sync-step">
              <p className="peer-sync-hint">
                <Icon name="info" size={13} /> Send this code back to the other device to finish
                connecting.
              </p>
              <div className="peer-sync-qr">
                <QrCode data={myCode} size={200} />
              </div>
              <div className="peer-sync-code-row">
                <textarea className="textarea mono" readOnly rows={3} value={myCode} />
                <button type="button" className="btn btn-ghost btn-icon" onClick={() => void handleCopy()}>
                  <Icon name={copied ? 'check' : 'copy'} size={14} />
                </button>
              </div>
              <p className="peer-sync-waiting">
                <span className="peer-sync-spinner" aria-hidden /> Waiting for connection…
              </p>
            </div>
          )}

          {stage === 'connecting' && (
            <p className="peer-sync-waiting">
              <span className="peer-sync-spinner" aria-hidden /> Connecting…
            </p>
          )}

          {stage === 'syncing' && (
            <p className="peer-sync-waiting">
              <span className="peer-sync-spinner" aria-hidden /> Connected — syncing “{trip.name}”…
            </p>
          )}

          {stage === 'done' && (
            <div className="peer-sync-done">
              <Icon name="check" size={22} />
              <strong>Synced.</strong>
              <p>
                {added > 0
                  ? `${added} new or updated item${added !== 1 ? 's' : ''} from the other device.`
                  : 'Both devices already matched — nothing new to merge.'}
              </p>
            </div>
          )}

          {stage === 'error' && error && (
            <p className="docs-error">
              <Icon name="warning" size={13} /> {error}
            </p>
          )}
        </div>
      )}
    </Dialog>
  )
}
