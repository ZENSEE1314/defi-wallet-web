"use client";
import type { WalletRecord } from "@/lib/wallet/keystore";

type Tab = "wallets" | "networks" | "send" | "connect";

export function Sidebar({ tab, onChange, onLock, activeWallet }: { tab: Tab; onChange: (t: Tab) => void; onLock?: () => void; activeWallet?: WalletRecord | null }) {
  return (
    <aside className="bg-elev/70 backdrop-blur-xl border-r border-border p-4 flex flex-col gap-1 w-64">
      <div className="flex items-center gap-2 mx-1 mb-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-[#7a3dff] flex items-center justify-center text-white font-bold text-sm">D</div>
        <div>
          <div className="text-sm font-semibold leading-tight">DeFi Wallet</div>
          <div className="text-[10px] text-dim leading-tight">Self-custody</div>
        </div>
      </div>

      {activeWallet && (
        <div className="mx-1 mb-3 p-2.5 rounded-lg bg-bg/40 border border-border">
          <div className="text-[10px] uppercase tracking-wider text-dim">Active</div>
          <div className="text-sm font-medium truncate">{activeWallet.name}</div>
          <div className="text-[10px] font-mono text-dim truncate">{activeWallet.address}</div>
        </div>
      )}

      <button className={`nav-item ${tab === "wallets" ? "active" : ""}`} onClick={() => onChange("wallets")}>
        <span className="inline-block w-4 mr-2 text-center">◆</span>Wallets
      </button>
      <button className={`nav-item ${tab === "networks" ? "active" : ""}`} onClick={() => onChange("networks")}>
        <span className="inline-block w-4 mr-2 text-center">⬡</span>Networks
      </button>
      <button className={`nav-item ${tab === "send" ? "active" : ""}`} onClick={() => onChange("send")}>
        <span className="inline-block w-4 mr-2 text-center">↗</span>Send
      </button>
      <button className={`nav-item ${tab === "connect" ? "active" : ""}`} onClick={() => onChange("connect")}>
        <span className="inline-block w-4 mr-2 text-center">⚡</span>WalletConnect
      </button>

      <div className="mt-auto">
        <button onClick={onLock} className="nav-item text-dim hover:text-danger w-full">
          <span className="inline-block w-4 mr-2 text-center">🔒</span>Lock wallet
        </button>
        <div className="text-[10px] text-dim leading-relaxed mx-2 mt-3">
          Open any dApp → choose <strong className="text-text">WalletConnect</strong> → paste URI in WalletConnect tab.
        </div>
      </div>
    </aside>
  );
}

export type { Tab };
