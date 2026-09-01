import crypto from "node:crypto";

import { env } from "../../../config/env.js";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey(): Buffer | null {
  const hex = env.SETTINGS_ENCRYPTION_KEY;
  if (!hex) return null;
  return Buffer.from(hex, "hex");
}

export interface EncryptedPayload {
  v: number;
  iv: string;
  tag: string;
  data: string;
}

const VERSION = 1;

/**
 * Encrypt a plaintext string with AES-256-GCM.
 * Returns null if no key configured (stores plaintext path should mask instead).
 */
export function encryptSecret(plain: string): EncryptedPayload | string {
  const key = getKey();
  if (!key) return plain;
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv) as crypto.CipherGCM;
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    v: VERSION,
    iv: iv.toString("hex"),
    tag: tag.toString("hex"),
    data: enc.toString("hex"),
  };
}

export function decryptSecret(payload: unknown): string {
  if (typeof payload === "string") return payload;
  if (!payload || typeof payload !== "object") return "";
  const p = payload as EncryptedPayload;
  if (!p.iv || !p.tag || !p.data) return typeof p.data === "string" ? p.data : "";
  const key = getKey();
  if (!key) return typeof p.data === "string" ? p.data : "";
  try {
    const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(p.iv, "hex")) as crypto.DecipherGCM;
    decipher.setAuthTag(Buffer.from(p.tag, "hex"));
    const dec = Buffer.concat([decipher.update(Buffer.from(p.data, "hex")), decipher.final()]);
    return dec.toString("utf8");
  } catch {
    return "";
  }
}

export function isEncryptedPayload(value: unknown): value is EncryptedPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    "v" in value &&
    "iv" in value &&
    "tag" in value &&
    "data" in value
  );
}
