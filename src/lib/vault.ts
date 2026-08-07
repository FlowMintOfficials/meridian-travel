/**
 * Vault passphrase proof — stores an encrypted verifier so unlock can
 * reject wrong PINs before touching any documents.
 */

import {
  decryptBlob,
  deriveKey,
  encryptBlob,
  fromBase64,
  randomBytes,
  textToBytes,
  toBase64,
} from './crypto'
import type { VaultLock } from '../types'

const VERIFIER_PLAINTEXT = 'meridian.vault.ok.v1'

export async function createVaultLock(passphrase: string): Promise<VaultLock> {
  const salt = randomBytes(16)
  const key = await deriveKey(passphrase, salt)
  const { ciphertext, iv } = await encryptBlob(key, textToBytes(VERIFIER_PLAINTEXT))
  return {
    salt: toBase64(salt),
    iv,
    verifier: ciphertext,
  }
}

/** Returns true only when the passphrase decrypts the stored verifier. */
export async function verifyVaultLock(
  passphrase: string,
  lock: VaultLock,
): Promise<boolean> {
  try {
    const salt = fromBase64(lock.salt)
    if (salt.byteLength < 8) return false
    const key = await deriveKey(passphrase, salt)
    const plain = await decryptBlob(key, lock.verifier, lock.iv)
    const text = new TextDecoder().decode(plain)
    return text === VERIFIER_PLAINTEXT
  } catch {
    return false
  }
}
