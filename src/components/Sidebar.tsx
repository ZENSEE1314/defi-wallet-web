"use client";

type Tab = "wallets" | "networks" | "send" | "connect";

export function Sidebar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <aside className="bg-elev border-r border-border p-4 flex flex-col gap-1 w-60">
      <h1 className="text-xs uppercase tracking-widest text-dim mx-2 mb-3">DeFi Wallet</h1>
      <button className={`nav-item ${tab === "wallets" ? "active" : ""}`} onClick={() => onChange("wallets")}>Wallets</button>
      <button className={`nav-item ${tab === "networks" ? "active" : ""}`} onClick={() => onChange("networks")}>Networks</button>
      <button className={`nav-item ${tab === "send" ? "active" : ""}`} onClick={() => onChange("send")}>Send</button>
      <button className={`nav-item ${tab === "connect" ? "active" : ""}`} onClick={() => onChange("connect")}>WalletConnect</button>
      <div className="mt-auto text-xs text-dim leading-relaxed mx-2">
        Open Uniswap or any dApp, choose <strong>WalletConnect</strong>, then paste the connection URI in the WalletConnect tab.
      </div>
    </aside>
  );
}

export type { Tab };
