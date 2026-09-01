import { describe, it, expect } from "vitest";
import {
  encryptSecret,
  decryptSecret,
  isEncryptedPayload,
} from "../../../src/modules/settings/utils/encryption.js";

describe("encryptSecret", () => {
  it("returns an encrypted payload (random IV, non-deterministic)", () => {
    const a = encryptSecret("hunter2");
    const b = encryptSecret("hunter2");
    expect(isEncryptedPayload(a)).toBe(true);
    expect(isEncryptedPayload(b)).toBe(true);
    if (!isEncryptedPayload(a) || !isEncryptedPayload(b)) return;
    expect(a.iv).not.toBe(b.iv);
    expect(a.data).not.toBe(b.data);
    expect(a.data).not.toContain("hunter2");
  });

  it("never embeds the plaintext in the payload", () => {
    const payload = encryptSecret("super-secret-value");
    expect(JSON.stringify(payload)).not.toContain("super-secret-value");
  });
});

describe("decryptSecret", () => {
  it("round-trips an encrypted payload", () => {
    const payload = encryptSecret("round-trip-value");
    expect(decryptSecret(payload)).toBe("round-trip-value");
  });

  it("passes plaintext strings through untouched", () => {
    expect(decryptSecret("plain")).toBe("plain");
  });

  it("returns empty string for malformed payloads", () => {
    expect(decryptSecret(null)).toBe("");
    expect(decryptSecret(42)).toBe("");
    expect(decryptSecret({})).toBe("");
  });

  it("returns empty string when the auth tag is tampered with", () => {
    const payload = encryptSecret("tamper-me");
    if (!isEncryptedPayload(payload)) throw new Error("expected encrypted payload");
    const tampered = { ...payload, tag: "0".repeat(32) };
    expect(decryptSecret(tampered)).toBe("");
  });

  it("returns empty string when the ciphertext is tampered with", () => {
    const payload = encryptSecret("tamper-me");
    if (!isEncryptedPayload(payload)) throw new Error("expected encrypted payload");
    const tampered = { ...payload, data: "ff" + payload.data.slice(2) };
    expect(decryptSecret(tampered)).toBe("");
  });
});

describe("isEncryptedPayload", () => {
  it("accepts well-formed payloads and rejects everything else", () => {
    expect(isEncryptedPayload({ v: 1, iv: "aa", tag: "bb", data: "cc" })).toBe(true);
    expect(isEncryptedPayload({ iv: "aa", tag: "bb", data: "cc" })).toBe(false);
    expect(isEncryptedPayload("string")).toBe(false);
    expect(isEncryptedPayload(null)).toBe(false);
  });
});
