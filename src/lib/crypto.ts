/**
 * Web-Crypto helpers for encrypting document blobs (passport scans, etc.)
 * before they land in localStorage / IndexedDB.
 *
 * Documents are the only sensitive assets in Meridian. The main app data
 * (trip metadata, packing, itinerary, expenses) lives as plain JSON so
 * that the user can export & inspect it easily. Passport-grade material
 * gets AES-GCM.
 */

const PBKDF2_ITERATIONS = 250_000
const KEY_ALGO = { name: 'AES-GCM', length: 256 } as const

const enc = new TextEncoder()
const dec = new TextDecoder()

export function randomBytes(length: number): Uint8Array {
  const buf = new Uint8Array(length)
  crypto.getRandomValues(buf)
  return buf
}

export function toBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.byteLength; i++) s += String.fromCharCode(bytes[i])
  return btoa(s)
}

export function fromBase64(b64: string): Uint8Array {
  const s = atob(b64)
  const bytes = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i)
  return bytes
}

export async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase) as BufferSource,
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    material,
    KEY_ALGO,
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptBlob(
  key: CryptoKey,
  bytes: Uint8Array,
): Promise<{ ciphertext: string; iv: string }> {
  const iv = randomBytes(12)
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    bytes as BufferSource,
  )
  return { ciphertext: toBase64(cipher), iv: toBase64(iv) }
}

export async function decryptBlob(
  key: CryptoKey,
  ciphertextB64: string,
  ivB64: string,
): Promise<Uint8Array> {
  const cipher = fromBase64(ciphertextB64)
  const iv = fromBase64(ivB64)
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    cipher as BufferSource,
  )
  return new Uint8Array(plain)
}

export function textToBytes(s: string): Uint8Array {
  return enc.encode(s)
}

export function bytesToText(b: Uint8Array): string {
  return dec.decode(b)
}
