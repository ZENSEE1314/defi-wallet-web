// Browser-side AES-256-GCM with PBKDF2-derived key. Uses Web Crypto.

const PBKDF2_ITERATIONS = 310_000;
const PBKDF2_HASH = "SHA-256";
const SALT_LEN = 16;
const IV_LEN = 12;

export type EncryptedBlob = {
  v: 1;
  salt: string;
  iv: string;
  ct: string;
};

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of u8) s += String.fromCharCode(b);
  return btoa(s);
}

function unb64(s: string): Uint8Array {
  const bin = atob(s);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: PBKDF2_HASH },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encrypt(plaintext: string, password: string): Promise<EncryptedBlob> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const key = await deriveKey(password, salt);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plaintext));
  return { v: 1, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
}

export async function decrypt(blob: EncryptedBlob, password: string): Promise<string> {
  if (blob.v !== 1) throw new Error(`unsupported keystore version: ${blob.v}`);
  const salt = unb64(blob.salt);
  const iv = unb64(blob.iv);
  const ct = unb64(blob.ct);
  const key = await deriveKey(password, salt);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return dec.decode(pt);
}
