/**
 * AES-256-GCM encryption utility for storing cloud provider secrets.
 * Uses the ENCRYPTION_KEY env var (32-byte hex string) as the symmetric key.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV recommended for GCM

function getKey(): Buffer {
  const hex = process.env["ENCRYPTION_KEY"];
  if (!hex || hex.length !== 64) {
    throw new Error(
      "ENCRYPTION_KEY must be a 64-character hex string (32 bytes)."
    );
  }
  return Buffer.from(hex, "hex");
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decrypt(encryptedBase64: string): string {
  const key = getKey();
  const data = Buffer.from(encryptedBase64, "base64");
  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + 16);
  const ciphertext = data.subarray(IV_LENGTH + 16);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf-8");
}

export function encryptIfPresent(plaintext: string | null | undefined): string | null {
  if (!plaintext) return null;
  return encrypt(plaintext);
}

export function decryptIfPresent(encrypted: string | null | undefined): string | null {
  if (!encrypted) return null;
  try {
    return decrypt(encrypted);
  } catch {
    return null;
  }
}
