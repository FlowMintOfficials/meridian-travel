import {
  bytesToText,
  decryptBlob,
  deriveKey,
  encryptBlob,
  fromBase64,
  randomBytes,
  textToBytes,
  toBase64,
} from './crypto'

/**
 * Optional passphrase-protected export for the *entire* backup, not just
 * the document vault. The vault (see lib/vault.ts) already proves these
 * primitives out — AES-256-GCM, a PBKDF2-derived key, a random salt and
 * IV per encryption — this just points the same primitives at the whole
 * JSON backup instead of individual document blobs, for anyone who wants
 * their exported trip data unreadable if the file itself leaks (an email
 * attachment, a shared drive, a lost USB stick).
 *
 * Deliberately independent of the vault passphrase / vaultLock: a backup
 * can be encrypted even if the vault was never set up, with a different
 * passphrase, and vice versa. Nothing here is stored — lose the
 * passphrase and the backup is unrecoverable, same tradeoff as the vault.
 */

export const ENCRYPTED_BACKUP_VERSION = 1

export interface EncryptedBackupFile {
  meridianEncryptedBackup: typeof ENCRYPTED_BACKUP_VERSION
  /** PBKDF2 salt (base64) — unique per export. */
  salt: string
  /** AES-GCM IV (base64). */
  iv: string
  /** AES-GCM ciphertext (base64) of the plain backup JSON. */
  ciphertext: string
}

/** Distinguishes an encrypted backup file from a plain one (or from
 * something that isn't a Meridian backup at all) purely by shape, so the
 * import flow can route to a passphrase prompt without guessing. */
export function isEncryptedBackup(value: unknown): value is EncryptedBackupFile {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Partial<EncryptedBackupFile>
  return (
    v.meridianEncryptedBackup === ENCRYPTED_BACKUP_VERSION &&
    typeof v.salt === 'string' &&
    typeof v.iv === 'string' &&
    typeof v.ciphertext === 'string'
  )
}

export async function encryptBackupJson(
  json: string,
  passphrase: string,
): Promise<EncryptedBackupFile> {
  const salt = randomBytes(16)
  const key = await deriveKey(passphrase, salt)
  const { ciphertext, iv } = await encryptBlob(key, textToBytes(json))
  return {
    meridianEncryptedBackup: ENCRYPTED_BACKUP_VERSION,
    salt: toBase64(salt),
    iv,
    ciphertext,
  }
}

/** Throws on a wrong passphrase or a corrupted file — AES-GCM's auth tag
 * makes both detectable (the decrypt call itself fails) rather than
 * silently handing back garbage bytes. */
export async function decryptBackupJson(
  file: EncryptedBackupFile,
  passphrase: string,
): Promise<string> {
  const salt = fromBase64(file.salt)
  if (salt.byteLength < 8) throw new Error('Malformed backup file.')
  const key = await deriveKey(passphrase, salt)
  const plain = await decryptBlob(key, file.ciphertext, file.iv)
  return bytesToText(plain)
}
