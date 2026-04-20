import type { TokenInfo } from "./registry";

const KEY = "defi-wallet-web:tokens:v1";

type Store = Record<number, TokenInfo[]>; // chainId → tokens

function load(): Store {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Store;
  } catch {
    return {};
  }
}

function save(s: Store): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function getCustomTokens(chainId: number): TokenInfo[] {
  return load()[chainId] ?? [];
}

export function addCustomToken(chainId: number, token: TokenInfo): void {
  const s = load();
  const list = s[chainId] ?? [];
  if (list.some((t) => t.address.toLowerCase() === token.address.toLowerCase())) return;
  s[chainId] = [...list, token];
  save(s);
}

export function removeCustomToken(chainId: number, address: string): void {
  const s = load();
  const list = s[chainId] ?? [];
  s[chainId] = list.filter((t) => t.address.toLowerCase() !== address.toLowerCase());
  save(s);
}
