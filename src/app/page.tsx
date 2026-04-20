"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { JsonRpcProvider, formatEther, parseEther } from "ethers";
import { Sidebar, type Tab } from "@/components/Sidebar";
import { PasswordPrompt } from "@/components/PasswordPrompt";
import { loadState, saveState, type AppState } from "@/lib/storage/store";
import { BUILTIN_CHAINS, findChain, type Chain } from "@/lib/chains/registry";
import {
  createMnemonicWallet,
  importMnemonicWallet,
  importPrivateKeyWallet,
  unlockWallet,
  deriveSigner,
  type WalletRecord
} from "@/lib/wallet/keystore";
import { init as wcInit, pair as wcPair, getActiveSessions, disconnect as wcDisconnect } from "@/lib/walletconnect/bridge";

type SessionView = ReturnType<typeof getActiveSessions>[number];

export default function Home() {
  const [tab, setTab] = useState<Tab>("wallets");
  const [state, setState] = useState<AppState>(loadState());
  const [sessions, setSessions] = useState<SessionView[]>([]);
  const wcReady = useRef(false);
  const [pwdRequest, setPwdRequest] = useState<{ title: string; message: string; details?: string; resolve: (v: string | null) => void } | null>(null);
  const [proposalPrompt, setProposalPrompt] = useState<{ name: string; chains: number[]; resolve: (ok: boolean) => void } | null>(null);
  const [wcUri, setWcUri] = useState("");
  const [wcStatus, setWcStatus] = useState<string | null>(null);

  useEffect(() => saveState(state), [state]);

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
    if (tab === "connect") void ensureWc();
  }, [tab, ensureWc]);

  return (
    <div className="flex h-screen">
      <Sidebar tab={tab} onChange={setTab} />
      <main className="flex-1 overflow-y-auto p-6">
        {tab === "wallets" && <WalletsPanel state={state} setState={setState} chain={activeChain} />}
        {tab === "networks" && <NetworksPanel state={state} setState={setState} />}
        {tab === "send" && <SendPanel state={state} chain={activeChain} />}
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

function WalletsPanel({ state, setState, chain }: { state: AppState; setState: (s: AppState) => void; chain: Chain }) {
  const [mode, setMode] = useState<"none" | "create" | "import-mn" | "import-pk">("none");
  const [balances, setBalances] = useState<Record<string, string>>({});
  const [revealing, setRevealing] = useState<WalletRecord | null>(null);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<WalletRecord | null>(null);

  useEffect(() => {
    const provider = new JsonRpcProvider(chain.rpcUrl, chain.id);
    state.wallets.forEach((w) => {
      provider.getBalance(w.address).then((wei) => setBalances((p) => ({ ...p, [w.id]: formatEther(wei) }))).catch(() => {});
    });
  }, [state.wallets, chain]);

  return (
    <>
      <h2 className="text-xl font-semibold mb-4">Wallets ({chain.name})</h2>
      <div className="card flex gap-2">
        <button className="btn" onClick={() => setMode("create")}>+ New wallet</button>
        <button className="btn-secondary" onClick={() => setMode("import-mn")}>Import seed phrase</button>
        <button className="btn-secondary" onClick={() => setMode("import-pk")}>Import private key</button>
      </div>

      {state.wallets.length === 0 && (
        <div className="card text-center text-dim">No wallets yet. Create or import one to get started.</div>
      )}

      {state.wallets.map((w) => (
        <div
          key={w.id}
          className={`card cursor-pointer flex justify-between items-center ${w.id === state.selectedWalletId ? "border-accent" : ""}`}
          onClick={() => setState({ ...state, selectedWalletId: w.id })}
        >
          <div>
            <div className="font-semibold">{w.name} <span className="badge ml-1">{w.source}</span></div>
            <div className="text-xs text-dim font-mono mt-0.5">{w.address}</div>
          </div>
          <div className="text-right">
            <div className="text-accent2 font-semibold">{balances[w.id] ?? "…"} {chain.symbol}</div>
            <div className="flex gap-1 mt-1 justify-end">
              <button className="btn-ghost" onClick={(e) => { e.stopPropagation(); setRevealing(w); setRevealed(null); }}>Reveal</button>
              <button className="btn-ghost text-danger" onClick={(e) => { e.stopPropagation(); setConfirmDelete(w); }}>Delete</button>
            </div>
          </div>
        </div>
      ))}

      {mode !== "none" && (
        <CreateOrImportModal
          mode={mode}
          onClose={() => setMode("none")}
          onDone={(record) => {
            setState({ ...state, wallets: [...state.wallets, record], selectedWalletId: record.id });
            setMode("none");
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
                  const next = state.wallets.filter((x) => x.id !== confirmDelete.id);
                  const sel = state.selectedWalletId === confirmDelete.id ? (next[0]?.id ?? null) : state.selectedWalletId;
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

function CreateOrImportModal({
  mode,
  onClose,
  onDone
}: {
  mode: "create" | "import-mn" | "import-pk";
  onClose: () => void;
  onDone: (r: WalletRecord) => void;
}) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);

  async function go() {
    if (!name || password.length < 8) {
      alert("Name required, password must be 8+ chars.");
      return;
    }
    setBusy(true);
    try {
      const rec =
        mode === "create"
          ? await createMnemonicWallet(name, password)
          : mode === "import-mn"
          ? await importMnemonicWallet(name, secret, password)
          : await importPrivateKeyWallet(name, secret, password);
      onDone(rec);
    } catch (e) {
      alert(`Failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  const title = mode === "create" ? "New wallet" : mode === "import-mn" ? "Import seed phrase" : "Import private key";

  return (
    <div className="modal-bg">
      <div className="modal">
        <h3 className="m-0 mb-3 text-base font-semibold">{title}</h3>
        <div className="flex flex-col gap-3">
          <div><label className="label">Name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Main wallet" /></div>
          {mode !== "create" && (
            <div>
              <label className="label">{mode === "import-mn" ? "Seed phrase (12 or 24 words)" : "Private key (0x…)"}</label>
              <textarea className="input" rows={3} value={secret} onChange={(e) => setSecret(e.target.value)} />
            </div>
          )}
          <div><label className="label">Password (8+ chars)</label><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        </div>
        <div className="flex gap-2 mt-4 justify-end">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={go} disabled={busy}>{busy ? "Working…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}

function NetworksPanel({ state, setState }: { state: AppState; setState: (s: AppState) => void }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ id: 0, name: "", symbol: "", rpcUrl: "", explorerUrl: "" });
  const all: Chain[] = [...BUILTIN_CHAINS, ...state.customChains.map((c) => ({ ...c, isCustom: true }))];

  return (
    <>
      <h2 className="text-xl font-semibold mb-4">Networks</h2>
      <div className="card"><button className="btn" onClick={() => setAdding(true)}>+ Add custom network</button></div>

      {all.map((c) => (
        <div
          key={c.id}
          className={`card cursor-pointer flex justify-between items-center ${c.id === state.selectedChainId ? "border-accent" : ""}`}
          onClick={() => setState({ ...state, selectedChainId: c.id })}
        >
          <div>
            <div className="font-semibold">{c.name} {c.isCustom && <span className="badge ml-1">custom</span>}</div>
            <div className="text-xs text-dim font-mono">Chain {c.id} • {c.symbol} • {c.rpcUrl}</div>
          </div>
          {c.isCustom && (
            <button
              className="btn-ghost text-danger"
              onClick={(e) => { e.stopPropagation(); setState({ ...state, customChains: state.customChains.filter((x) => x.id !== c.id) }); }}
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
                  setState({ ...state, customChains: [...state.customChains, form] });
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

function SendPanel({ state, chain }: { state: AppState; chain: Chain }) {
  const wallet = state.wallets.find((w) => w.id === state.selectedWalletId);
  const [to, setTo] = useState("");
  const [value, setValue] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function send() {
    if (!wallet) return;
    if (!to || !value || !password) { alert("Fill all fields."); return; }
    setBusy(true);
    setResult(null);
    try {
      const secret = await unlockWallet(wallet, password);
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

  if (!wallet) return <div className="card">Pick a wallet on the Wallets tab first.</div>;

  return (
    <>
      <h2 className="text-xl font-semibold mb-4">Send {chain.symbol} on {chain.name}</h2>
      <div className="card flex flex-col gap-3 max-w-lg">
        <div className="text-xs text-dim">From: <span className="font-mono">{wallet.address}</span></div>
        <div><label className="label">To address</label><input className="input" value={to} onChange={(e) => setTo(e.target.value)} placeholder="0x…" /></div>
        <div><label className="label">Amount ({chain.symbol})</label><input className="input" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0.01" /></div>
        <div><label className="label">Password</label><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <div><button className="btn" onClick={send} disabled={busy}>{busy ? "Sending…" : "Send"}</button></div>
        {result && (
          <div className="text-xs text-accent2">
            Sent — <a className="underline" target="_blank" rel="noreferrer" href={`${chain.explorerUrl}/tx/${result}`}>{result}</a>
          </div>
        )}
      </div>
    </>
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
  return (
    <>
      <h2 className="text-xl font-semibold mb-4">WalletConnect</h2>

      <div className="card max-w-2xl">
        <p className="text-sm text-dim mb-3">
          On the dApp (e.g. <a className="underline" target="_blank" rel="noreferrer" href="https://app.uniswap.org">app.uniswap.org</a>),
          choose Connect → WalletConnect, then click "Copy URI" instead of scanning the QR. Paste it here.
        </p>
        <div className="flex gap-2">
          <input className="input" placeholder="wc:abcd…" value={wcUri} onChange={(e) => setWcUri(e.target.value)} />
          <button className="btn" onClick={pair} disabled={!wcUri}>Pair</button>
        </div>
        {wcStatus && <div className="text-xs text-warning mt-2">{wcStatus}</div>}
      </div>

      <h3 className="text-sm font-semibold uppercase tracking-wider text-dim mt-6 mb-2">Active sessions</h3>
      {sessions.length === 0 && <div className="card text-dim text-sm">No active sessions.</div>}
      {sessions.map((s) => (
        <div key={s.topic} className="card flex justify-between items-center">
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
