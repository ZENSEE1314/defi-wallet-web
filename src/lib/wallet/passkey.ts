// Passkey-wrapped password unlock.
//
// Strategy: when the user opts in, we encrypt their wallet password with a key
// derived from a WebAuthn credential. The wrapped blob is stored in localStorage,
// keyed by credentialId. To unlock the wallet later, the browser shows the
// platform authenticator (Touch ID / Windows Hello / Android biometric); on
// success we decrypt the wrapped password and feed it to the existing keystore
// flow.
//
// We never store the raw password in plaintext anywhere.

const RP_NAME = "DeFi Wallet";
const STORE_KEY = "defi-wallet-web:passkey:v1";

type WrappedRecord = {
  credentialId: string; // base64url
  iv: string; // base64
  ct: string; // base64 (encrypted password bytes)
  walletId: string; // which wallet this passkey unlocks
};

type Store = { records: WrappedRecord[] };

const enc = new TextEncoder();
const dec = new TextDecoder();

export function isPasskeySupported(): boolean {
  return typeof window !== "undefined" && !!window.PublicKeyCredential && !!navigator.credentials;
}

export function getStore(): Store {
  if (typeof window === "undefined") return { records: [] };
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? "") as Store;
  } catch {
    return { records: [] };
  }
}

function setStore(s: Store): void {
  localStorage.setItem(STORE_KEY, JSON.stringify(s));
}

export function hasPasskeyFor(walletId: string): boolean {
  return getStore().records.some((r) => r.walletId === walletId);
}

export async function enrollPasskey(walletId: string, password: string, userLabel: string): Promise<void> {
  if (!isPasskeySupported()) throw new Error("Passkeys not supported on this browser");

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = enc.encode(walletId);

  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: toBuf(challenge),
      rp: { name: RP_NAME, id: window.location.hostname },
      user: { id: toBuf(userId), name: userLabel, displayName: userLabel },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 }, // ES256
        { type: "public-key", alg: -257 } // RS256
      ],
      authenticatorSelection: { userVerification: "required", residentKey: "preferred" },
      timeout: 60_000,
      attestation: "none"
    }
  })) as PublicKeyCredential | null;

  if (!credential) throw new Error("Passkey enrollment cancelled");

  // Derive a wrapping key from the credential.rawId — assertion will return the
  // same id, so we can reproduce the wrapping key on unlock.
  const wrappingKey = await deriveKeyFromBytes(new Uint8Array(credential.rawId));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: toBuf(iv) }, wrappingKey, toBuf(enc.encode(password)));

  const store = getStore();
  // Replace any existing record for this wallet.
  store.records = store.records.filter((r) => r.walletId !== walletId);
  store.records.push({
    credentialId: b64url(new Uint8Array(credential.rawId)),
    iv: b64(iv),
    ct: b64(new Uint8Array(ct)),
    walletId
  });
  setStore(store);
}

export async function unlockWithPasskey(walletId: string): Promise<string> {
  const record = getStore().records.find((r) => r.walletId === walletId);
  if (!record) throw new Error("No passkey enrolled for this wallet");

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const credIdBytes = unb64url(record.credentialId);

  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: toBuf(challenge),
      timeout: 60_000,
      userVerification: "required",
      allowCredentials: [{ type: "public-key", id: toBuf(credIdBytes) }]
    }
  })) as PublicKeyCredential | null;

  if (!assertion) throw new Error("Passkey unlock cancelled");

  const wrappingKey = await deriveKeyFromBytes(new Uint8Array(assertion.rawId));
  const iv = unb64(record.iv);
  const ct = unb64(record.ct);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: toBuf(iv) }, wrappingKey, toBuf(ct));
  return dec.decode(pt);
}

export function removePasskey(walletId: string): void {
  const store = getStore();
  store.records = store.records.filter((r) => r.walletId !== walletId);
  setStore(store);
}

async function deriveKeyFromBytes(bytes: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey("raw", toBuf(bytes), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: enc.encode("defi-wallet-passkey-wrap") },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

function toBuf(u8: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(u8.byteLength);
  new Uint8Array(out).set(u8);
  return out;
}
function b64(u8: Uint8Array): string {
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
function b64url(u8: Uint8Array): string {
  return b64(u8).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function unb64url(s: string): Uint8Array {
  let str = s.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return unb64(str);
}
