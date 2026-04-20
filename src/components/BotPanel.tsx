"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { botApi, loadConn, saveConn, type BotConn, type LogEvent, type Status, type Trade } from "@/lib/bot/client";

export function BotPanel() {
  const [conn, setConn] = useState<BotConn | null>(null);
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [tab, setTab] = useState<"logs" | "trades">("logs");
  const [err, setErr] = useState<string | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const c = loadConn();
    setConn(c);
    if (!c) setEditing(true);
  }, []);

  const refresh = useCallback(async () => {
    if (!conn) return;
    try {
      const [s, l, t] = await Promise.all([botApi.status(conn), botApi.logs(conn, 100), botApi.trades(conn, 50)]);
      setStatus(s);
      setLogs(l.events);
      setTrades(t.trades);
      setErr(null);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [conn]);

  useEffect(() => {
    if (!conn) return;
    refresh();
    pollRef.current = setInterval(refresh, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [conn, refresh]);

  async function toggle(field: "paperMode" | "momentumEnabled" | "frontrunEnabled", value: boolean) {
    if (!conn) return;
    try {
      const res = await botApi.toggle(conn, { [field]: value });
      setStatus((s) => (s ? { ...s, flags: res.flags } : s));
      if (field !== "paperMode") {
        alert(res.note);
      }
    } catch (e) {
      alert(`Toggle failed: ${(e as Error).message}`);
    }
  }

  if (editing || !conn) {
    return <ConnectForm initial={conn} onSave={(c) => { saveConn(c); setConn(c); setEditing(false); }} onCancel={conn ? () => setEditing(false) : undefined} />;
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Trading Bot</h2>
          <div className="text-xs text-dim mt-0.5 font-mono truncate max-w-md">{conn.url}</div>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={refresh}>Refresh</button>
          <button className="btn-ghost" onClick={() => setEditing(true)}>⚙ Connection</button>
        </div>
      </div>

      {err && <div className="glass-card text-danger text-sm">⚠ {err}</div>}

      {status && (
        <>
          <div className="glass-card">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <Stat label="Status" value={status.running ? "RUNNING" : "STOPPED"} accent={status.running ? "ok" : "warn"} />
              <Stat label="Mode" value={status.flags.paperMode ? "PAPER" : "LIVE"} accent={status.flags.paperMode ? "ok" : "danger"} />
              <Stat label="Positions" value={String(status.positions.length)} />
              <Stat label="Trades" value={String(status.tradeCount)} />
            </div>

            <div className="border-t border-border pt-3 space-y-2">
              <ToggleRow label="Paper mode (simulate, no real txs)" enabled={status.flags.paperMode} onChange={(v) => toggle("paperMode", v)} />
              <ToggleRow label="Top-volume momentum scanner" enabled={status.flags.momentumEnabled} onChange={(v) => toggle("momentumEnabled", v)} />
              <ToggleRow label="Mempool front-runner" enabled={status.flags.frontrunEnabled} onChange={(v) => toggle("frontrunEnabled", v)} />
              <p className="text-[11px] text-dim mt-2">Paper mode flips immediately. Enabling/disabling momentum or front-runner needs a Railway redeploy to take effect.</p>
            </div>
          </div>

          {status.positions.length > 0 && (
            <div className="glass-card">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-dim mb-2">Open positions</h3>
              <div className="space-y-1 text-sm">
                {status.positions.map((p) => (
                  <div key={p.token} className="flex justify-between items-center font-mono text-xs">
                    <span>{p.symbol} <span className="text-dim">({p.token.slice(0, 8)}…)</span></span>
                    <span className="text-accent2">held {Math.floor((Date.now() - p.acquiredAt) / 60000)}m</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="glass-card">
            <div className="flex gap-2 mb-3 border-b border-border">
              <TabBtn active={tab === "logs"} onClick={() => setTab("logs")}>Logs ({logs.length})</TabBtn>
              <TabBtn active={tab === "trades"} onClick={() => setTab("trades")}>Trades ({trades.length})</TabBtn>
            </div>
            {tab === "logs" ? <LogsView events={logs} /> : <TradesView trades={trades} />}
          </div>
        </>
      )}
    </>
  );
}

function ConnectForm({ initial, onSave, onCancel }: { initial: BotConn | null; onSave: (c: BotConn) => void; onCancel?: () => void }) {
  const [url, setUrl] = useState(initial?.url ?? "");
  const [token, setToken] = useState(initial?.token ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function test() {
    setErr(null);
    setBusy(true);
    try {
      const c = { url: url.replace(/\/$/, ""), token };
      await botApi.health(c);
      // health doesn't auth — also try status which does
      await botApi.status(c);
      onSave(c);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h2 className="text-2xl font-semibold tracking-tight mb-1">Trading Bot</h2>
      <p className="text-xs text-dim mb-4">Connect to your bot's HTTP control plane to view logs, trades, and toggle modes.</p>
      <div className="glass-card max-w-xl space-y-3">
        <div>
          <label className="label">Bot URL</label>
          <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-bot.up.railway.app" />
          <p className="text-[11px] text-dim mt-1">In Railway: defi-wallet service → Settings → Networking → Generate Domain. Paste the public URL here.</p>
        </div>
        <div>
          <label className="label">API token</label>
          <input className="input font-mono text-xs" type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="set BOT_API_TOKEN env var on Railway" />
          <p className="text-[11px] text-dim mt-1">Same value as <code className="text-text">BOT_API_TOKEN</code> on Railway. Generate a long random one with <code className="text-text">openssl rand -hex 32</code>.</p>
        </div>
        {err && <div className="text-xs text-danger">{err}</div>}
        <div className="flex gap-2 justify-end">
          {onCancel && <button className="btn-secondary" onClick={onCancel}>Cancel</button>}
          <button className="btn" onClick={test} disabled={busy || !url || !token}>{busy ? "Testing…" : "Connect"}</button>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: "ok" | "warn" | "danger" }) {
  const color = accent === "ok" ? "text-accent2" : accent === "warn" ? "text-warning" : accent === "danger" ? "text-danger" : "text-text";
  return (
    <div className="bg-bg/40 border border-border rounded-md p-3">
      <div className="text-[10px] uppercase tracking-wider text-dim mb-1">{label}</div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
    </div>
  );
}

function ToggleRow({ label, enabled, onChange }: { label: string; enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between cursor-pointer text-sm">
      <span>{label}</span>
      <span className="relative inline-flex items-center">
        <input type="checkbox" className="sr-only peer" checked={enabled} onChange={(e) => onChange(e.target.checked)} />
        <span className="w-10 h-6 bg-elev2 border border-border rounded-full peer-checked:bg-accent transition-colors" />
        <span className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-4" />
      </span>
    </label>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`px-3 py-2 text-sm border-b-2 transition ${active ? "border-accent text-accent" : "border-transparent text-dim hover:text-text"}`}>
      {children}
    </button>
  );
}

function LogsView({ events }: { events: LogEvent[] }) {
  if (events.length === 0) return <div className="text-dim text-sm p-3">No events yet. The bot logs every scan, signal, buy, sell, and heartbeat here.</div>;
  return (
    <div className="font-mono text-[11px] max-h-[420px] overflow-y-auto space-y-0.5">
      {events.map((e, i) => <LogLine key={i} e={e} />)}
    </div>
  );
}

function LogLine({ e }: { e: LogEvent }) {
  const color =
    e.kind === "buy" ? "text-accent2"
      : e.kind === "sell" ? "text-warning"
      : e.kind === "error" ? "text-danger"
      : e.kind === "discovered" || e.kind === "frontrun" ? "text-accent"
      : e.kind === "momentum" ? "text-[#c89dff]"
      : "text-dim";
  return (
    <div className={`${color} truncate`}>
      <span className="text-dim">[{new Date().toLocaleTimeString()}]</span> {summarize(e)}
    </div>
  );
}

function summarize(e: LogEvent): string {
  switch (e.kind) {
    case "heartbeat": return `heartbeat · ${(e as { positions?: number }).positions ?? 0} positions`;
    case "buy": return `BUY ${String(e.token).slice(0, 8)}… for ${e.amountEth} ETH ${e.paper ? "(paper)" : "→ " + String(e.hash).slice(0, 10) + "…"}`;
    case "sell": return `SELL ${String(e.token).slice(0, 8)}… reason=${e.reason} ${e.paper ? "(paper)" : ""}`;
    case "discovered": {
      const t = e.token as { baseToken?: { symbol?: string }; priceUsd?: number };
      return `discovered ${t.baseToken?.symbol} @ $${t.priceUsd?.toFixed(6)}`;
    }
    case "frontrun": {
      const ev = e.event as LogEvent;
      return `frontrun:${ev.kind} ${JSON.stringify(ev).slice(0, 120)}`;
    }
    case "momentum": {
      const ev = e.event as LogEvent;
      return `momentum:${ev.kind} ${JSON.stringify(ev).slice(0, 140)}`;
    }
    case "skip": return `skip ${e.token} — ${e.reason}`;
    case "error": return `ERROR ${e.message}`;
    case "whale": return `whale ${JSON.stringify(e.event).slice(0, 140)}`;
    default: return JSON.stringify(e).slice(0, 200);
  }
}

function TradesView({ trades }: { trades: Trade[] }) {
  if (trades.length === 0) return <div className="text-dim text-sm p-3">No trades yet. Buys and sells from any strategy will appear here as they happen.</div>;
  return (
    <div className="overflow-x-auto -mx-4">
      <table className="w-full text-xs min-w-[640px]">
        <thead>
          <tr className="text-dim uppercase tracking-wider text-[10px]">
            <th className="text-left px-3 py-2">Time</th>
            <th className="text-left px-3 py-2">Side</th>
            <th className="text-left px-3 py-2">Source</th>
            <th className="text-left px-3 py-2">Token</th>
            <th className="text-right px-3 py-2">Amount / PnL</th>
            <th className="text-left px-3 py-2">Mode</th>
            <th className="text-left px-3 py-2">Tx</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t, i) => (
            <tr key={i} className="border-t border-border">
              <td className="px-3 py-2 text-dim">{new Date(t.ts).toLocaleTimeString()}</td>
              <td className={`px-3 py-2 font-semibold ${t.kind === "buy" ? "text-accent2" : "text-warning"}`}>{t.kind.toUpperCase()}</td>
              <td className="px-3 py-2 text-dim">{t.source}</td>
              <td className="px-3 py-2 font-mono">{t.symbol ?? t.token.slice(0, 8) + "…"}</td>
              <td className="px-3 py-2 text-right font-mono">
                {t.amountEth ? `${t.amountEth} ETH` : t.pnlPct !== undefined ? `${t.pnlPct.toFixed(2)}%` : t.reason ?? ""}
              </td>
              <td className={`px-3 py-2 ${t.paper ? "text-accent2" : "text-danger"}`}>{t.paper ? "paper" : "LIVE"}</td>
              <td className="px-3 py-2 font-mono text-dim">{t.hash.slice(0, 10)}…</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
