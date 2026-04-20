// Persists app state in localStorage. Encrypted keystores live alongside it
// (the secrets inside them remain AES-GCM encrypted with the user's password).

import type { WalletRecord } from "../wallet/keystore";

export type AppState = {
  wallets: WalletRecord[];
  selectedWalletId: string | null;
  customChains: { id: number; name: string; symbol: string; rpcUrl: string; explorerUrl: string }[];
  selectedChainId: number;
};

const KEY = "defi-wallet-web:state:v1";

const DEFAULT: AppState = {
  wallets: [],
  selectedWalletId: null,
  customChains: [],
  selectedChainId: 1
};

export function loadState(): AppState {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    return { ...DEFAULT, ...JSON.parse(raw) };
  } catch {
    return DEFAULT;
  }
}

export function saveState(state: AppState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(state));
}
