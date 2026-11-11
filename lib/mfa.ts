import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const PERIOD_SECONDS = 30;

function encryptionKey() {
  const configured = process.env.MFA_ENCRYPTION_KEY;
  if (configured && /^[a-fA-F0-9]{64}$/.test(configured)) return Buffer.from(configured, "hex");
  if (process.env.NODE_ENV === "production") {
    throw new Error("MFA_ENCRYPTION_KEY must be a 64-character hexadecimal value in production.");
  }
  return createHash("sha256")
    .update(process.env.SESSION_SECRET ?? "kinledger-development-mfa-key-change-before-production")
    .digest();
}

function encodeBase32(bytes: Buffer) {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32[(value << (5 - bits)) & 31];
  return output;
}

function decodeBase32(value: string) {
  let bits = 0;
  let buffer = 0;
  const bytes: number[] = [];
  for (const char of value.toUpperCase().replace(/=+$/g, "")) {
    const index = BASE32.indexOf(char);
    if (index < 0) throw new Error("Invalid authenticator secret.");
    buffer = (buffer << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((buffer >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function newTotpSecret() {
  return encodeBase32(randomBytes(20));
}

function totpAt(secret: string, timestampMs: number) {
  const counter = Math.floor(timestampMs / 1000 / PERIOD_SECONDS);
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", decodeBase32(secret)).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

export function verifyTotp(secret: string, code: string, now = Date.now()) {
  const normalized = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalized)) return false;
  const candidate = Buffer.from(normalized);
  for (const offset of [-1, 0, 1]) {
    const expected = Buffer.from(totpAt(secret, now + offset * PERIOD_SECONDS * 1000));
    if (timingSafeEqual(candidate, expected)) return true;
  }
  return false;
}

export function encryptTotpSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptTotpSecret(value: string) {
  const [ivValue, tagValue, encryptedValue] = value.split(".");
  if (!ivValue || !tagValue || !encryptedValue) throw new Error("Stored authenticator secret is invalid.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function recoveryCodeHash(code: string) {
  return createHash("sha256").update(code.trim().replace(/-/g, "").toUpperCase()).digest("hex");
}

export function createRecoveryCodes() {
  const codes = Array.from({ length: 10 }, () => {
    const raw = randomBytes(8).toString("hex").toUpperCase();
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12)}`;
  });
  return { codes, hashes: codes.map(recoveryCodeHash) };
}

export function matchingRecoveryCode(code: string, hashes: string[]) {
  const candidate = Buffer.from(recoveryCodeHash(code));
  for (let index = 0; index < hashes.length; index += 1) {
    const stored = Buffer.from(hashes[index]);
    if (candidate.length === stored.length && timingSafeEqual(candidate, stored)) return index;
  }
  return -1;
}
