"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { JsonRpcProvider, formatEther, parseEther } from "ethers";
import { Sidebar, type Tab } from "@/components/Sidebar";
import { PasswordPrompt } from "@/components/PasswordPrompt";
import { PasswordInput } from "@/components/PasswordInput";
import { QrScanModal } from "@/components/QrScanModal";
import { ReceiveModal } from "@/components/ReceiveModal";
import { AddWalletModal } from "@/components/AddWalletModal";
import { Onboarding } from "@/components/Onboarding";
import { BotPanel } from "@/components/BotPanel";
import { isAddress } from "ethers";
import { getDefaultTokens, type TokenInfo } from "@/lib/tokens/registry";
import { getCustomTokens, addCustomToken, removeCustomToken } from "@/lib/tokens/custom";
import { getErc20Balance, getErc20Metadata } from "@/lib/tokens/balance";
import { loadState, saveState, type AppState } from "@/lib/storage/store";
import { BUILTIN_CHAINS, findChain, type Chain } from "@/lib/chains/registry";
import {
  unlockWallet,
  deriveSigner,
  type WalletRecord
} from "@/lib/wallet/keystore";
import { hasPasskeyFor, removePasskey, enrollPasskey, isPasskeySupported } from "@/lib/wallet/passkey";
import { init as wcInit, pair as wcPair, getActiveSessions, disconnect as wcDisconnect } from "@/lib/walletconnect/bridge";

type SessionView = ReturnType<typeof getActiveSessions>[number];

export default function Home() {
  // Start with empty default on every render so SSR + first client render match.
  // Real state is hydrated from localStorage in the effect below.
  const [state, setState] = useState<AppState>({ wallets: [], selectedWalletId: null, customChains: [], selectedChainId: 1 });
  const [hydrated, setHydrated] = useState(false);
  const [tab, setTab] = useState<Tab>("wallets");
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    setState(loadState());
    setHydrated(true);
  }, []);
  // Session-only password cache. Cleared on tab close. Used to skip prompts
  // during the same browser session if the user opted in.
  const sessionPwd = useRef<string | null>(null);
  const [sessions, setSessions] = useState<SessionView[]>([]);
  const wcReady = useRef(false);
  const [pwdRequest, setPwdRequest] = useState<{ title: string; message: string; details?: string; resolve: (v: string | null) => void } | null>(null);
  const [proposalPrompt, setProposalPrompt] = useState<{ name: string; chains: number[]; resolve: (ok: boolean) => void } | null>(null);
  const [wcUri, setWcUri] = useState("");
  const [wcStatus, setWcStatus] = useState<string | null>(null);

  useEffect(() => { if (hydrated) saveState(state); }, [state, hydrated]);

  const allChains: Chain[] = [...BUILTIN_CHAINS, ...state.customChains.map((c) => ({ ...c, isCustom: true }))];
  const activeChain = findChain(allChains, state.selectedChainId) ?? BUILTIN_CHAINS[0];
  const activeWallet = state.wallets.find((w) => w.id === state.selectedWalletId) ?? null;

  const refreshSessions = useCallback(() => setSessions(getActiveSessions()), []);

  const ensureWc = useCallback(async () => {
    if (wcReady.current) return;
    const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
    if (!projectId) {
      setWcStatus("Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID in your env to use WalletConnect.");
      return;
    }
    await wcInit(projectId, {
      getActiveWallet: () => activeWallet,
      getActiveChain: () => activeChain,
      getAllChains: () => allChains,
      onSessionsChanged: refreshSessions,
      promptPassword: (info) =>
        new Promise<string | null>((resolve) => {
          // If we have a session-cached password, use it without prompting.
          if (sessionPwd.current) return resolve(sessionPwd.current);
          setPwdRequest({
            title: `Confirm ${info.method}`,
            message: `dApp wants ${info.method} from ${info.address.slice(0, 8)}…${info.address.slice(-6)}`,
            details: info.details,
            resolve
          });
        }),
      promptApproveSession: (proposer, chains) =>
        new Promise<boolean>((resolve) => {
          setProposalPrompt({ name: proposer.name || proposer.url || "unknown dApp", chains, resolve });
        })
    });
    wcReady.current = true;
    refreshSessions();
  }, [activeWallet, activeChain, allChains, refreshSessions]);

  useEffect(() => {
    if (tab === "connect" && unlocked) void ensureWc();
  }, [tab, unlocked, ensureWc]);

  function handleUnlocked(wallet: WalletRecord, password: string) {
    sessionPwd.current = password;
    setState((s) => ({ ...s, selectedWalletId: wallet.id }));
    setUnlocked(true);
  }

  function handleCreated(record: WalletRecord, password: string) {
    sessionPwd.current = password;
    setState((s) => ({ ...s, wallets: [...s.wallets, record], selectedWalletId: record.id }));
    setUnlocked(true);
  }

  function lock() {
    sessionPwd.current = null;
    setUnlocked(false);
    wcReady.current = false;
    setSessions([]);
  }

  if (!hydrated) {
    return <div className="min-h-screen relative z-10" />;
  }

  if (!unlocked) {
    return <div className="relative z-10"><Onboarding existingWallets={state.wallets} onCreated={handleCreated} onUnlocked={handleUnlocked} /></div>;
  }

  return (
    <div className="flex h-screen relative z-10 pt-12 md:pt-0">
      <Sidebar tab={tab} onChange={setTab} onLock={lock} activeWallet={activeWallet} />
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        {tab === "wallets" && <WalletsPanel state={state} setState={setState} chain={activeChain} sessionPwd={sessionPwd} />}
        {tab === "networks" && <NetworksPanel state={state} setState={setState} />}
        {tab === "send" && <SendPanel state={state} chain={activeChain} sessionPwd={sessionPwd} />}
        {tab === "bot" && <BotPanel />}
        {tab === "connect" && (
          <ConnectPanel
            wcStatus={wcStatus}
            wcUri={wcUri}
            setWcUri={setWcUri}
            sessions={sessions}
            disconnect={async (topic) => { await wcDisconnect(topic); refreshSessions(); }}
            pair={async () => {
              try {
                await ensureWc();
                if (!wcReady.current) return;
                await wcPair(wcUri.trim());
                setWcUri("");
                setWcStatus("Pairing… approve the session prompt when it appears.");
              } catch (e) {
                setWcStatus(`Pair failed: ${(e as Error).message}`);
              }
            }}
          />
        )}
      </main>

      {pwdRequest && (
        <PasswordPrompt
          title={pwdRequest.title}
          message={pwdRequest.message}
          details={pwdRequest.details}
          onCancel={() => { pwdRequest.resolve(null); setPwdRequest(null); }}
          onSubmit={(pwd) => { pwdRequest.resolve(pwd); setPwdRequest(null); }}
        />
      )}

      {proposalPrompt && (
        <div className="modal-bg">
          <div className="modal">
            <h3 className="m-0 mb-3 text-base font-semibold">Connect to {proposalPrompt.name}?</h3>
            <p className="text-dim text-sm mb-3">Requested chains: {proposalPrompt.chains.join(", ") || "none specified"}</p>
            <p className="text-dim text-xs mb-3">Active wallet: {activeWallet?.address ?? "(none — pick one in Wallets first)"}</p>
            <div className="flex gap-2 justify-end">
              <button className="btn-secondary" onClick={() => { proposalPrompt.resolve(false); setProposalPrompt(null); }}>Reject</button>
              <button className="btn" onClick={() => { proposalPrompt.resolve(true); setProposalPrompt(null); refreshSessions(); }}>Approve</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WalletsPanel({
  state,
  setState,
  chain,
  sessionPwd
}: {
  state: AppState;
  setState: (s: AppState | ((p: AppState) => AppState)) => void;
  chain: Chain;
  sessionPwd: React.MutableRefObject<string | null>;
}) {
  const [nativeBal, setNativeBal] = useState<Record<string, string>>({});
  const [tokenBalances, setTokenBalances] = useState<Record<string, Record<string, string>>>({}); // walletId → tokenAddr → balance
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [revealing, setRevealing] = useState<WalletRecord | null>(null);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<WalletRecord | null>(null);
  const [receiving, setReceiving] = useState<WalletRecord | null>(null);
  const [addingToken, setAddingToken] = useState(false);
  const [addingWallet, setAddingWallet] = useState(false);

  // Refresh tokens whenever chain changes
  useEffect(() => {
    setTokens([...getDefaultTokens(chain.id), ...getCustomTokens(chain.id)]);
  }, [chain.id]);

  // Fetch balances
  useEffect(() => {
    const provider = new JsonRpcProvider(chain.rpcUrl, chain.id);
    state.wallets.forEach((w) => {
      provider.getBalance(w.address).then((wei) => setNativeBal((p) => ({ ...p, [w.id]: formatEther(wei) }))).catch(() => {});
      tokens.forEach((t) => {
        getErc20Balance(provider, t.address, w.address, t.decimals)
          .then((bal) => setTokenBalances((p) => ({ ...p, [w.id]: { ...(p[w.id] ?? {}), [t.address]: bal } })))
          .catch(() => {});
      });
    });
  }, [state.wallets, chain, tokens]);

  return (
    <>
      <PageHeader title="Wallets" subtitle={`${chain.name} · tap address to copy, scan to receive`} />
      <div className="glass-card flex justify-between items-center">
        <div className="text-sm text-dim">{state.wallets.length} wallet{state.wallets.length === 1 ? "" : "s"}</div>
        <button className="btn" onClick={() => setAddingWallet(true)}>+ Add wallet</button>
      </div>
      {state.wallets.map((w) => {
        const isActive = w.id === state.selectedWalletId;
        const bals = tokenBalances[w.id] ?? {};
        return (
          <div
            key={w.id}
            className={`glass-card cursor-pointer transition ${isActive ? "ring-1 ring-accent" : ""}`}
            onClick={() => setState((s) => ({ ...s, selectedWalletId: w.id }))}
          >
            <div className="flex justify-between items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-semibold flex items-center gap-2">{w.name} <span className="badge">{w.source}</span></div>
                <div
                  className="text-xs text-dim font-mono mt-0.5 truncate cursor-copy"
                  onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(w.address); }}
                  title="Click to copy"
                >
                  {w.address}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-accent2 font-semibold">{nativeBal[w.id] ?? "…"} {chain.symbol}</div>
              </div>
            </div>

            {tokens.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border space-y-1">
                {tokens.map((t) => (
                  <div key={t.address} className="flex justify-between items-center text-sm">
                    <span className="text-dim">{t.symbol}</span>
                    <span className="font-mono">{bals[t.address] ?? "…"}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-1 mt-3 justify-end flex-wrap">
              <button className="btn-ghost text-accent" onClick={(e) => { e.stopPropagation(); setReceiving(w); }}>Receive</button>
              <BiometricToggle wallet={w} sessionPwd={sessionPwd} />
              <button className="btn-ghost" onClick={(e) => { e.stopPropagation(); setRevealing(w); setRevealed(null); }}>Reveal</button>
              <button className="btn-ghost text-danger" onClick={(e) => { e.stopPropagation(); setConfirmDelete(w); }}>Delete</button>
            </div>
          </div>
        );
      })}

      {state.wallets.length > 0 && (
        <div className="glass-card flex flex-wrap gap-2 items-center justify-between">
          <div className="text-sm text-dim">Tokens shown ({tokens.length}) — USDT/USDC auto-included for {chain.name}</div>
          <button className="btn-secondary" onClick={() => setAddingToken(true)}>+ Add token</button>
        </div>
      )}

      {receiving && (
        <ReceiveModal
          address={receiving.address}
          walletName={receiving.name}
          chainName={chain.name}
          onClose={() => setReceiving(null)}
        />
      )}

      {addingWallet && (
        <AddWalletModal
          onClose={() => setAddingWallet(false)}
          onDone={(record) => {
            setState((s) => ({ ...s, wallets: [...s.wallets, record], selectedWalletId: record.id }));
            setAddingWallet(false);
          }}
        />
      )}

      {addingToken && (
        <AddTokenModal
          chainId={chain.id}
          rpcUrl={chain.rpcUrl}
          existingAddrs={tokens.map((t) => t.address.toLowerCase())}
          onClose={() => setAddingToken(false)}
          onAdded={() => {
            setTokens([...getDefaultTokens(chain.id), ...getCustomTokens(chain.id)]);
            setAddingToken(false);
          }}
        />
      )}

      {revealing && !revealed && (
        <PasswordPrompt
          title={`Reveal secret — ${revealing.name}`}
          message="Your password decrypts the keystore. The plaintext stays on this page only."
          onCancel={() => setRevealing(null)}
          onSubmit={async (pwd) => {
            try {
              const secret = await unlockWallet(revealing, pwd);
              setRevealed(secret);
            } catch {
              alert("Wrong password.");
            }
          }}
        />
      )}

      {revealed && (
        <div className="modal-bg">
          <div className="modal">
            <h3 className="m-0 mb-3 text-base font-semibold">Secret (do not share)</h3>
            <textarea readOnly value={revealed} rows={4} className="input font-mono" />
            <div className="flex justify-end mt-3">
              <button className="btn" onClick={() => { setRevealed(null); setRevealing(null); }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="modal-bg">
          <div className="modal">
            <h3 className="m-0 mb-3 text-base font-semibold">Delete wallet?</h3>
            <p className="text-dim text-sm mb-3">
              Removing <strong>{confirmDelete.name}</strong> deletes the encrypted keystore from this browser.
              If you don't have the seed phrase / private key backed up, the funds will be unrecoverable.
            </p>
            <div className="flex gap-2 justify-end">
              <button className="btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button
                className="btn-danger"
                onClick={() => {
                  if (hasPasskeyFor(confirmDelete.id)) removePasskey(confirmDelete.id);
                  const next = state.wallets.filter((x) => x.id !== confirmDelete.id);
                  const sel = state.selectedWalletId === confirmDelete.id ? (next[0]?.id ?? null) : state.selectedWalletId;
                  if (state.selectedWalletId === confirmDelete.id) sessionPwd.current = null;
                  setState({ ...state, wallets: next, selectedWalletId: sel });
                  setConfirmDelete(null);
                }}
              >
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function NetworksPanel({ state, setState }: { state: AppState; setState: (s: AppState | ((p: AppState) => AppState)) => void }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ id: 0, name: "", symbol: "", rpcUrl: "", explorerUrl: "" });
  const all: Chain[] = [...BUILTIN_CHAINS, ...state.customChains.map((c) => ({ ...c, isCustom: true }))];

  return (
    <>
      <PageHeader title="Networks" subtitle="Built-in + custom EVM chains" />
      <div className="glass-card"><button className="btn" onClick={() => setAdding(true)}>+ Add custom network</button></div>

      {all.map((c) => (
        <div
          key={c.id}
          className={`glass-card cursor-pointer flex justify-between items-center transition ${c.id === state.selectedChainId ? "ring-1 ring-accent" : ""}`}
          onClick={() => setState((s) => ({ ...s, selectedChainId: c.id }))}
        >
          <div>
            <div className="font-semibold">{c.name} {c.isCustom && <span className="badge ml-1">custom</span>}</div>
            <div className="text-xs text-dim font-mono">Chain {c.id} · {c.symbol} · {c.rpcUrl}</div>
          </div>
          {c.isCustom && (
            <button
              className="btn-ghost text-danger"
              onClick={(e) => { e.stopPropagation(); setState((s) => ({ ...s, customChains: s.customChains.filter((x) => x.id !== c.id) })); }}
            >
              Remove
            </button>
          )}
        </div>
      ))}

      {adding && (
        <div className="modal-bg">
          <div className="modal">
            <h3 className="m-0 mb-3 text-base font-semibold">Add custom network</h3>
            <div className="flex flex-col gap-3">
              <div><label className="label">Chain ID</label><input className="input" type="number" value={form.id || ""} onChange={(e) => setForm({ ...form, id: Number(e.target.value) })} /></div>
              <div><label className="label">Name</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><label className="label">Symbol</label><input className="input" value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value })} placeholder="ETH" /></div>
              <div><label className="label">RPC URL</label><input className="input" value={form.rpcUrl} onChange={(e) => setForm({ ...form, rpcUrl: e.target.value })} /></div>
              <div><label className="label">Explorer URL</label><input className="input" value={form.explorerUrl} onChange={(e) => setForm({ ...form, explorerUrl: e.target.value })} /></div>
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <button className="btn-secondary" onClick={() => setAdding(false)}>Cancel</button>
              <button
                className="btn"
                onClick={() => {
                  if (!form.id || !form.name || !form.rpcUrl) { alert("id, name, rpcUrl required"); return; }
                  if (all.some((c) => c.id === form.id)) { alert("That chain id already exists."); return; }
                  setState((s) => ({ ...s, customChains: [...s.customChains, form] }));
                  setAdding(false);
                  setForm({ id: 0, name: "", symbol: "", rpcUrl: "", explorerUrl: "" });
                }}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SendPanel({
  state,
  chain,
  sessionPwd
}: {
  state: AppState;
  chain: Chain;
  sessionPwd: React.MutableRefObject<string | null>;
}) {
  const wallet = state.wallets.find((w) => w.id === state.selectedWalletId);
  const [to, setTo] = useState("");
  const [value, setValue] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  function handleAddressScan(text: string): boolean {
    // Accept bare 0x… addresses and EIP-681 URIs like ethereum:0xabc?value=1e18
    const m = text.match(/0x[a-fA-F0-9]{40}/);
    if (!m) return false;
    setTo(m[0]);
    const valueMatch = text.match(/[?&]value=(\d+(?:\.\d+)?(?:e\d+)?)/);
    if (valueMatch) {
      const num = Number(valueMatch[1]);
      // EIP-681 value is in wei; if this looks like wei (>1e10) divide by 1e18.
      setValue(num > 1e10 ? (num / 1e18).toString() : num.toString());
    }
    return true;
  }

  async function send() {
    if (!wallet) return;
    const pwd = sessionPwd.current ?? password;
    if (!to || !value || !pwd) { alert("Fill all fields."); return; }
    setBusy(true);
    setResult(null);
    try {
      const secret = await unlockWallet(wallet, pwd);
      const provider = new JsonRpcProvider(chain.rpcUrl, chain.id);
      const signer = deriveSigner(secret, wallet.source).connect(provider);
      const tx = await signer.sendTransaction({ to, value: parseEther(value) });
      setResult(tx.hash);
      setPassword("");
    } catch (e) {
      alert(`Send failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  if (!wallet) return <div className="glass-card">Pick a wallet on the Wallets tab first.</div>;

  return (
    <>
      <PageHeader title={`Send ${chain.symbol}`} subtitle={`On ${chain.name}`} />
      <div className="glass-card flex flex-col gap-3 max-w-lg">
        <div className="text-xs text-dim">From: <span className="font-mono">{wallet.address}</span></div>
        <div>
          <label className="label">To address</label>
          <div className="flex gap-2">
            <input className="input" value={to} onChange={(e) => setTo(e.target.value)} placeholder="0x…" />
            <button type="button" className="btn-secondary shrink-0" onClick={() => setScanning(true)} title="Scan QR">
              <ScanIcon />
            </button>
          </div>
          {to && !isAddress(to) && <div className="text-[11px] text-warning mt-1">Not a valid address.</div>}
        </div>
        <div><label className="label">Amount ({chain.symbol})</label><input className="input" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0.01" /></div>
        {!sessionPwd.current && <PasswordInput label="Password" value={password} onChange={setPassword} placeholder="••••••••" />}
        <div><button className="btn" onClick={send} disabled={busy}>{busy ? "Sending…" : "Send"}</button></div>
        {result && (
          <div className="text-xs text-accent2 break-all">
            Sent — <a className="underline" target="_blank" rel="noreferrer" href={`${chain.explorerUrl}/tx/${result}`}>{result}</a>
          </div>
        )}
      </div>
      {scanning && (
        <QrScanModal
          title="Scan recipient address"
          hint="Point at a wallet QR (0x… or ethereum: URI)"
          onScan={handleAddressScan}
          onClose={() => setScanning(false)}
        />
      )}
    </>
  );
}

function ScanIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
      <rect x="7" y="7" width="10" height="10" rx="1" />
    </svg>
  );
}

function ConnectPanel({
  wcStatus,
  wcUri,
  setWcUri,
  sessions,
  pair,
  disconnect
}: {
  wcStatus: string | null;
  wcUri: string;
  setWcUri: (s: string) => void;
  sessions: SessionView[];
  pair: () => Promise<void>;
  disconnect: (topic: string) => Promise<void>;
}) {
  const [scanning, setScanning] = useState(false);

  return (
    <>
      <PageHeader title="WalletConnect" subtitle="Connect any dApp via QR / URI" />

      <div className="glass-card max-w-2xl">
        <p className="text-sm text-dim mb-3">
          On the dApp (e.g. <a className="underline text-accent" target="_blank" rel="noreferrer" href="https://app.uniswap.org">app.uniswap.org</a>),
          choose Connect → WalletConnect, then either tap the camera icon below to <strong>scan the QR</strong> or click "Copy URI" and paste below.
        </p>
        <div className="flex gap-2">
          <input className="input" placeholder="wc:abcd…" value={wcUri} onChange={(e) => setWcUri(e.target.value)} />
          <button type="button" className="btn-secondary shrink-0" onClick={() => setScanning(true)} title="Scan QR">
            <ScanIcon />
          </button>
          <button className="btn" onClick={pair} disabled={!wcUri}>Pair</button>
        </div>
        {wcStatus && <div className="text-xs text-warning mt-2">{wcStatus}</div>}
      </div>

      {scanning && (
        <QrScanModal
          title="Scan WalletConnect QR"
          hint="Open the dApp, choose WalletConnect, and aim at the QR code."
          onScan={(text) => {
            if (!text.startsWith("wc:")) return false;
            setWcUri(text);
            // Auto-pair right after scanning.
            setTimeout(() => pair(), 100);
            return true;
          }}
          onClose={() => setScanning(false)}
        />
      )}

      <h3 className="text-sm font-semibold uppercase tracking-wider text-dim mt-6 mb-2">Active sessions</h3>
      {sessions.length === 0 && <div className="glass-card text-dim text-sm">No active sessions.</div>}
      {sessions.map((s) => (
        <div key={s.topic} className="glass-card flex justify-between items-center">
          <div>
            <div className="font-semibold">{s.peer.name || s.peer.url || "(unknown dApp)"}</div>
            <div className="text-xs text-dim font-mono">{s.peer.url}</div>
            <div className="text-xs text-dim mt-0.5">Chains: {s.chains.join(", ")}</div>
          </div>
          <button className="btn-danger" onClick={() => disconnect(s.topic)}>Disconnect</button>
        </div>
      ))}
    </>
  );
}

function BiometricToggle({
  wallet,
  sessionPwd
}: {
  wallet: WalletRecord;
  sessionPwd: React.MutableRefObject<string | null>;
}) {
  const [enrolled, setEnrolled] = useState<boolean>(false);
  const [busy, setBusy] = useState(false);
  const [needPwd, setNeedPwd] = useState(false);

  useEffect(() => {
    setEnrolled(hasPasskeyFor(wallet.id));
  }, [wallet.id]);

  if (!isPasskeySupported()) return null;

  async function enroll(pwd: string, opts: { skipVerify?: boolean } = {}) {
    setBusy(true);
    try {
      // Skip verification if we already have a valid session password — this
      // preserves the user-gesture window so WebAuthn can fire immediately.
      if (!opts.skipVerify) await unlockWallet(wallet, pwd);
      await enrollPasskey(wallet.id, pwd, wallet.name);
      setEnrolled(true);
    } catch (e) {
      const msg = (e as Error).message;
      // Specific messaging for the most common Windows error
      if (/NotAllowed|not allowed/i.test(msg)) {
        alert("Biometric setup was cancelled or blocked. Make sure Windows Hello is set up (Settings → Accounts → Sign-in options → PIN), then try again. The prompt must be answered within ~30 seconds.");
      } else {
        alert(`Couldn't enable biometric: ${msg}`);
      }
    } finally {
      setBusy(false);
      setNeedPwd(false);
    }
  }

  function disable() {
    if (!confirm("Turn off biometric unlock for this wallet?")) return;
    removePasskey(wallet.id);
    setEnrolled(false);
  }

  if (enrolled) {
    return (
      <button className="btn-ghost text-accent2" onClick={(e) => { e.stopPropagation(); disable(); }} title="Biometric unlock enabled">
        🔐 Bio ✓
      </button>
    );
  }

  return (
    <>
      <button
        className="btn-ghost"
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation();
          // If we have a session password, skip verification so the WebAuthn
          // prompt fires inside the same user-gesture window.
          if (sessionPwd.current) enroll(sessionPwd.current, { skipVerify: true });
          else setNeedPwd(true);
        }}
        title="Enable biometric unlock"
      >
        🔐 Set up bio
      </button>
      {needPwd && (
        <PasswordPrompt
          title={`Enable biometric — ${wallet.name}`}
          message="Confirm your wallet password to enroll a passkey for biometric unlock."
          onCancel={() => setNeedPwd(false)}
          onSubmit={(pwd) => enroll(pwd)}
        />
      )}
    </>
  );
}

function AddTokenModal({
  chainId,
  rpcUrl,
  existingAddrs,
  onClose,
  onAdded
}: {
  chainId: number;
  rpcUrl: string;
  existingAddrs: string[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const [addr, setAddr] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ symbol: string; name: string; decimals: number } | null>(null);

  async function lookup() {
    setErr(null);
    setPreview(null);
    if (!isAddress(addr)) return setErr("Not a valid contract address.");
    if (existingAddrs.includes(addr.toLowerCase())) return setErr("Token already added.");
    setBusy(true);
    try {
      const provider = new JsonRpcProvider(rpcUrl, chainId);
      const meta = await getErc20Metadata(provider, addr);
      setPreview(meta);
    } catch (e) {
      setErr(`Couldn't read token: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  function add() {
    if (!preview) return;
    addCustomToken(chainId, { address: addr, ...preview });
    onAdded();
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold">Add custom token</h3>
          <button onClick={onClose} className="text-dim hover:text-text text-xl leading-none">×</button>
        </div>
        <p className="text-xs text-dim mb-3">Paste the ERC-20 contract address. The bot will read symbol + decimals from the chain.</p>
        <div>
          <label className="label">Contract address</label>
          <input className="input font-mono text-xs" value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="0x…" onKeyDown={(e) => e.key === "Enter" && lookup()} />
        </div>
        {err && <div className="text-xs text-danger mt-2">{err}</div>}
        {preview && (
          <div className="mt-3 p-3 bg-bg/60 border border-border rounded-md text-sm">
            <div className="font-semibold">{preview.name} <span className="text-dim font-normal">({preview.symbol})</span></div>
            <div className="text-xs text-dim">decimals: {preview.decimals}</div>
          </div>
        )}
        <div className="flex gap-2 mt-4 justify-end">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          {preview ? (
            <button className="btn" onClick={add}>Add token</button>
          ) : (
            <button className="btn" onClick={lookup} disabled={busy || !addr}>{busy ? "Reading…" : "Look up"}</button>
          )}
        </div>
      </div>
    </div>
  );
}

function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      {subtitle && <div className="text-xs text-dim mt-0.5">{subtitle}</div>}
    </div>
  );
}
