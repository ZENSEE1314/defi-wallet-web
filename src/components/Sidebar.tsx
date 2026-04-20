"use client";
import { useState } from "react";
import type { WalletRecord } from "@/lib/wallet/keystore";

type Tab = "wallets" | "networks" | "send" | "connect" | "bot";

export function Sidebar({
  tab,
  onChange,
  onLock,
  activeWallet
}: {
  tab: Tab;
  onChange: (t: Tab) => void;
  onLock?: () => void;
  activeWallet?: WalletRecord | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 bg-elev/80 backdrop-blur-xl border-b border-border">
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="p-2 -ml-2">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-accent to-[#7a3dff] flex items-center justify-center text-white font-bold text-xs">D</div>
          <div className="text-sm font-semibold">DeFi Wallet</div>
        </div>
        <button onClick={onLock} aria-label="Lock" className="p-2 -mr-2 text-dim">🔒</button>
      </div>

      {/* Mobile drawer backdrop */}
      {open && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
      )}

      {/* Sidebar — drawer on mobile, static on md+ */}
      <aside
        className={`bg-elev/80 backdrop-blur-xl border-r border-border p-4 flex flex-col gap-1 w-64
          fixed md:static inset-y-0 left-0 z-50 transition-transform duration-200
          ${open ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
      >
        <div className="hidden md:flex items-center gap-2 mx-1 mb-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-[#7a3dff] flex items-center justify-center text-white font-bold text-sm">D</div>
          <div>
            <div className="text-sm font-semibold leading-tight">DeFi Wallet</div>
            <div className="text-[10px] text-dim leading-tight">Self-custody</div>
          </div>
        </div>

        {/* Mobile close */}
        <button className="md:hidden self-end text-dim text-2xl mb-2 -mr-1" onClick={() => setOpen(false)} aria-label="Close menu">×</button>

        {activeWallet && (
          <div className="mx-1 mb-3 p-2.5 rounded-lg bg-bg/40 border border-border">
            <div className="text-[10px] uppercase tracking-wider text-dim">Active</div>
            <div className="text-sm font-medium truncate">{activeWallet.name}</div>
            <div className="text-[10px] font-mono text-dim truncate">{activeWallet.address}</div>
          </div>
        )}

        <NavBtn label="Wallets" icon="◆" active={tab === "wallets"} onClick={() => { onChange("wallets"); setOpen(false); }} />
        <NavBtn label="Networks" icon="⬡" active={tab === "networks"} onClick={() => { onChange("networks"); setOpen(false); }} />
        <NavBtn label="Send" icon="↗" active={tab === "send"} onClick={() => { onChange("send"); setOpen(false); }} />
        <NavBtn label="WalletConnect" icon="⚡" active={tab === "connect"} onClick={() => { onChange("connect"); setOpen(false); }} />
        <NavBtn label="Trading Bot" icon="🤖" active={tab === "bot"} onClick={() => { onChange("bot"); setOpen(false); }} />

        <div className="mt-auto">
          <button onClick={onLock} className="nav-item text-dim hover:text-danger w-full">
            <span className="inline-block w-4 mr-2 text-center">🔒</span>Lock wallet
          </button>
          <div className="text-[10px] text-dim leading-relaxed mx-2 mt-3 hidden md:block">
            Open any dApp → choose <strong className="text-text">WalletConnect</strong> → paste URI here.
          </div>
        </div>
      </aside>
    </>
  );
}

function NavBtn({ label, icon, active, onClick }: { label: string; icon: string; active: boolean; onClick: () => void }) {
  return (
    <button className={`nav-item ${active ? "active" : ""}`} onClick={onClick}>
      <span className="inline-block w-4 mr-2 text-center">{icon}</span>{label}
    </button>
  );
}

export type { Tab };
