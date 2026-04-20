import { HDNodeWallet, Mnemonic, Wallet } from "ethers";
import { encrypt, decrypt, type EncryptedBlob } from "./crypto";

const DERIVATION_PATH = "m/44'/60'/0'/0";

export type WalletRecord = {
  id: string;
  name: string;
  address: string;
  createdAt: number;
  source: "mnemonic" | "privateKey";
  encrypted: EncryptedBlob;
};

function newId(): string {
  return `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function createMnemonicWallet(name: string, password: string): Promise<WalletRecord> {
  const entropy = crypto.getRandomValues(new Uint8Array(16));
  const mnemonic = Mnemonic.fromEntropy(entropy);
  const node = HDNodeWallet.fromMnemonic(mnemonic, `${DERIVATION_PATH}/0`);
  return build(name, node.address, mnemonic.phrase, "mnemonic", password);
}

export async function importMnemonicWallet(name: string, phrase: string, password: string): Promise<WalletRecord> {
  const mnemonic = Mnemonic.fromPhrase(phrase.trim());
  const node = HDNodeWallet.fromMnemonic(mnemonic, `${DERIVATION_PATH}/0`);
  return build(name, node.address, mnemonic.phrase, "mnemonic", password);
}

export async function importPrivateKeyWallet(name: string, pk: string, password: string): Promise<WalletRecord> {
  const cleaned = pk.trim().startsWith("0x") ? pk.trim() : `0x${pk.trim()}`;
  const w = new Wallet(cleaned);
  return build(name, w.address, w.privateKey, "privateKey", password);
}

async function build(
  name: string,
  address: string,
  secret: string,
  source: WalletRecord["source"],
  password: string
): Promise<WalletRecord> {
  return {
    id: newId(),
    name,
    address,
    createdAt: Date.now(),
    source,
    encrypted: await encrypt(secret, password)
  };
}

export async function unlockWallet(record: WalletRecord, password: string): Promise<string> {
  return decrypt(record.encrypted, password);
}

export function deriveSigner(secret: string, source: WalletRecord["source"]): Wallet | HDNodeWallet {
  if (source === "mnemonic") {
    return HDNodeWallet.fromMnemonic(Mnemonic.fromPhrase(secret), `${DERIVATION_PATH}/0`);
  }
  return new Wallet(secret);
}
