"use client";
import { useEffect, useState } from "react";
import { formatUnits } from "ethers";
import { fetchHistory, type TxRow } from "@/lib/tokens/history";

type Props = {
  address: string;
  walletName: string;
  chainId: number;
  chainName: string;
  nativeSymbol: string;
  explorerUrl: string;
  onClose: () => void;
};

export function HistoryModal({ address, walletName, chainId, chainName, nativeSymbol, explorerUrl, onClose }: Props) {
  const [rows, setRows] = useState<TxRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchHistory(chainId, address, nativeSymbol)
      .then((r) => { setRows(r); setErr(null); })
      .catch((e) => setErr((e as Error).message))
      .finally(() => setLoading(false));
  }, [chainId, address, nativeSymbol]);

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal max-w-2xl w-[95vw]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-semibold">Transactions · {walletName}</h3>
            <div className="text-xs text-dim mt-0.5">{chainName} · last 50</div>
          </div>
          <button onClick={onClose} className="text-dim hover:text-text text-xl leading-none">×</button>
        </div>

        {loading && <div className="text-dim text-sm py-6 text-center">Loading from explorer…</div>}

        {err && (
          <div className="text-danger text-sm py-3">
            ⚠ {err}
            <div className="text-dim text-xs mt-1">
              Free tier of the explorer API rate-limits aggressively. Set <code>NEXT_PUBLIC_ETHERSCAN_API_KEY</code> in Vercel env (free at etherscan.io/myapikey) to lift the limit.
            </div>
          </div>
        )}

        {rows && rows.length === 0 && !loading && !err && (
          <div className="text-dim text-sm py-6 text-center">No transactions yet.</div>
        )}

        {rows && rows.length > 0 && (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-dim uppercase tracking-wider text-[10px]">
                  <th className="text-left px-3 py-2">Time</th>
                  <th className="text-left px-3 py-2">Direction</th>
                  <th className="text-left px-3 py-2">Counterparty</th>
                  <th className="text-right px-3 py-2">Amount</th>
                  <th className="text-left px-3 py-2">Tx</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const me = address.toLowerCase();
                  const isOut = r.from.toLowerCase() === me;
                  const counter = isOut ? r.to : r.from;
                  return (
                    <tr key={`${r.hash}-${i}`} className={`border-t border-border ${r.isError ? "opacity-50" : ""}`}>
                      <td className="px-3 py-2 text-dim whitespace-nowrap">{relTime(r.timestamp)}</td>
                      <td className={`px-3 py-2 font-semibold ${isOut ? "text-warning" : "text-accent2"}`}>
                        {isOut ? "↗ OUT" : "↙ IN"}
                        {r.isError && <span className="ml-1 text-danger text-[10px]">(failed)</span>}
                      </td>
                      <td className="px-3 py-2 font-mono">{counter ? counter.slice(0, 8) + "…" + counter.slice(-4) : "(contract)"}</td>
                      <td className="px-3 py-2 text-right font-mono">
                        {formatAmount(r.valueWei, r.decimals)} {r.symbol}
                      </td>
                      <td className="px-3 py-2">
                        <a
                          href={`${explorerUrl}/tx/${r.hash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-accent hover:underline font-mono text-[11px]"
                        >
                          {r.hash.slice(0, 10)}↗
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-between items-center mt-4 pt-3 border-t border-border">
          <a
            href={`${explorerUrl}/address/${address}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-accent hover:underline"
          >
            Open full history on {hostname(explorerUrl)} ↗
          </a>
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function formatAmount(valueWei: string, decimals: number): string {
  try {
    const f = formatUnits(valueWei, decimals);
    const n = Number(f);
    if (n === 0) return "0";
    if (n < 0.0001) return n.toExponential(2);
    if (n < 1) return n.toFixed(6);
    if (n < 10000) return n.toFixed(4);
    return n.toFixed(2);
  } catch {
    return valueWei;
  }
}

function relTime(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

function hostname(url: string): string {
  try { return new URL(url).hostname; } catch { return "explorer"; }
}
