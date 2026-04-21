// Client-side history: accumulates EVERY log + trade ever seen across polls,
// dedupes them, and persists in localStorage so refresh / restart doesn't lose
// data. Caps total stored to keep localStorage usage reasonable.

import type { LogEvent, Trade } from "./client";

const LOG_KEY = "defi-wallet-web:bot-history-logs:v1";
const TRADE_KEY = "defi-wallet-web:bot-history-trades:v1";
const LOG_CAP = 5000;
const TRADE_CAP = 2000;

// Stable hash for a log event — combines kind + content to detect duplicates.
function logKey(e: LogEvent): string {
  return JSON.stringify(e);
}

function tradeKey(t: Trade): string {
  return `${t.ts}|${t.hash}|${t.kind}`;
}

export function loadLogHistory(): LogEvent[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(LOG_KEY) ?? "[]"); } catch { return []; }
}

export function loadTradeHistory(): Trade[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(TRADE_KEY) ?? "[]"); } catch { return []; }
}

export function saveLogHistory(events: LogEvent[]): void {
  const capped = events.slice(-LOG_CAP);
  localStorage.setItem(LOG_KEY, JSON.stringify(capped));
}

export function saveTradeHistory(trades: Trade[]): void {
  const capped = trades.slice(-TRADE_CAP);
  localStorage.setItem(TRADE_KEY, JSON.stringify(capped));
}

// Merge a fresh API page into an accumulated history, deduped, oldest first.
export function mergeLogs(history: LogEvent[], page: LogEvent[]): LogEvent[] {
  const seen = new Set(history.map(logKey));
  // page comes back newest-first from the API; reverse so we append in chrono order
  const fresh = [...page].reverse().filter((e) => !seen.has(logKey(e)));
  if (fresh.length === 0) return history;
  return [...history, ...fresh].slice(-LOG_CAP);
}

export function mergeTrades(history: Trade[], page: Trade[]): Trade[] {
  const seen = new Set(history.map(tradeKey));
  const fresh = [...page].reverse().filter((t) => !seen.has(tradeKey(t)));
  if (fresh.length === 0) return history;
  return [...history, ...fresh].slice(-TRADE_CAP);
}

export function clearLogHistory(): void { localStorage.removeItem(LOG_KEY); }
export function clearTradeHistory(): void { localStorage.removeItem(TRADE_KEY); }

export function tradesToCsv(trades: Trade[]): string {
  const header = "time,side,source,symbol,token,amount_eth,reason,pnl_pct,mode,tx_hash";
  const rows = trades.map((t) => [
    new Date(t.ts).toISOString(),
    t.kind,
    t.source,
    t.symbol ?? "",
    t.token,
    t.amountEth ?? "",
    t.reason ?? "",
    t.pnlPct?.toFixed(4) ?? "",
    t.paper ? "paper" : "live",
    t.hash
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
  return [header, ...rows].join("\n");
}

export function downloadFile(name: string, content: string, mime = "text/csv"): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
