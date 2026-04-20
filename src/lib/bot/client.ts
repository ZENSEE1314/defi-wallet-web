// Tiny client for the bot's HTTP control plane.

export type BotConn = { url: string; token: string };

const KEY = "defi-wallet-web:bot-conn:v1";

export function loadConn(): BotConn | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "null");
  } catch {
    return null;
  }
}

export function saveConn(c: BotConn | null): void {
  if (typeof window === "undefined") return;
  if (c) localStorage.setItem(KEY, JSON.stringify(c));
  else localStorage.removeItem(KEY);
}

async function call<T>(c: BotConn, path: string, init?: RequestInit): Promise<T> {
  const url = c.url.replace(/\/$/, "") + path;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${c.token}`,
      ...(init?.headers ?? {})
    }
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}${txt ? `: ${txt.slice(0, 100)}` : ""}`);
  }
  return res.json() as Promise<T>;
}

export type Status = {
  running: boolean;
  positions: { token: string; symbol: string; entryPriceUsd: number; amountEth: string; acquiredAt: number }[];
  flags: { paperMode: boolean; momentumEnabled: boolean; frontrunEnabled: boolean };
  logCount: number;
  tradeCount: number;
};

export type LogEvent = { kind: string; [k: string]: unknown };

export type Trade = {
  ts: number;
  kind: "buy" | "sell";
  source: string;
  symbol?: string;
  token: string;
  amountEth?: string;
  reason?: string;
  pnlPct?: number;
  hash: string;
  paper: boolean;
};

export const botApi = {
  health: (c: BotConn) => call<{ ok: boolean }>(c, "/api/health"),
  status: (c: BotConn) => call<Status>(c, "/api/status"),
  logs: (c: BotConn, limit = 200) => call<{ events: LogEvent[] }>(c, `/api/logs?limit=${limit}`),
  trades: (c: BotConn, limit = 100) => call<{ trades: Trade[] }>(c, `/api/trades?limit=${limit}`),
  toggle: (c: BotConn, flags: Partial<Status["flags"]>) => call<{ flags: Status["flags"]; note: string }>(c, "/api/toggle", { method: "POST", body: JSON.stringify(flags) }),
  clear: (c: BotConn, target: "logs" | "trades" | "all" = "all") => call<{ ok: boolean }>(c, `/api/clear?target=${target}`, { method: "POST" })
};
