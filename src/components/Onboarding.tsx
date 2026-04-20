"use client";
import { useEffect, useState } from "react";
import {
  createMnemonicWallet,
  importMnemonicWallet,
  importPrivateKeyWallet,
  unlockWallet,
  type WalletRecord
} from "@/lib/wallet/keystore";
import { PasswordInput } from "./PasswordInput";
import { QrScanModal } from "./QrScanModal";
import { enrollPasskey, hasPasskeyFor, isPasskeySupported, unlockWithPasskey } from "@/lib/wallet/passkey";

type Mode = "landing" | "create" | "unlock" | "restore";

type Props = {
  existingWallets: WalletRecord[];
  onCreated: (record: WalletRecord, sessionPassword: string) => void;
  onUnlocked: (wallet: WalletRecord, sessionPassword: string) => void;
};

export function Onboarding({ existingWallets, onCreated, onUnlocked }: Props) {
  const [mode, setMode] = useState<Mode>(existingWallets.length > 0 ? "unlock" : "landing");

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-elev/60 backdrop-blur border border-border text-xs text-dim mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-accent2 animate-pulse" /> Non-custodial · keys never leave your device
          </div>
          <h1 className="text-4xl font-semibold tracking-tight bg-gradient-to-br from-white via-white to-accent bg-clip-text text-transparent">
            DeFi Wallet
          </h1>
          <p className="text-dim mt-2 text-sm">Multi-chain · WalletConnect · Self-custody</p>
        </div>

        <div className="bg-elev/70 backdrop-blur-xl border border-border rounded-2xl p-6 shadow-2xl">
          {mode === "landing" && <Landing onCreate={() => setMode("create")} onRestore={() => setMode("restore")} />}
          {mode === "create" && <CreateForm onBack={() => setMode("landing")} onDone={onCreated} />}
          {mode === "unlock" && (
            <UnlockForm
              wallets={existingWallets}
              onUnlocked={onUnlocked}
              onForgot={() => setMode("restore")}
              onCreateNew={() => setMode("create")}
            />
          )}
          {mode === "restore" && <RestoreForm onBack={() => setMode(existingWallets.length > 0 ? "unlock" : "landing")} onDone={onCreated} />}
        </div>

        <p className="text-center text-xs text-dim mt-6 max-w-xs mx-auto">
          Hot wallet · use small balances. For real money use a hardware wallet.
        </p>
      </div>
    </div>
  );
}

function Landing({ onCreate, onRestore }: { onCreate: () => void; onRestore: () => void }) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold mb-1">Get started</h2>
      <p className="text-sm text-dim mb-4">No email, no servers — just a wallet that lives in this browser.</p>

      <button onClick={onCreate} className="w-full p-4 rounded-xl bg-gradient-to-br from-accent to-[#7a3dff] text-white text-left hover:brightness-110 transition group">
        <div className="font-semibold">Create new wallet</div>
        <div className="text-xs text-white/70 mt-0.5 group-hover:text-white/90">Generate a fresh seed phrase</div>
      </button>

      <button onClick={onRestore} className="w-full p-4 rounded-xl bg-elev2 border border-border text-left hover:border-accent transition group">
        <div className="font-semibold">I already have a wallet</div>
        <div className="text-xs text-dim mt-0.5 group-hover:text-text">Restore from seed phrase or private key</div>
      </button>
    </div>
  );
}

function CreateForm({ onBack, onDone }: { onBack: () => void; onDone: (r: WalletRecord, pw: string) => void }) {
  const [name, setName] = useState("Main wallet");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [enableBio, setEnableBio] = useState(isPasskeySupported());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function go() {
    setErr(null);
    if (!name) return setErr("Name required.");
    if (password.length < 8) return setErr("Password must be at least 8 characters.");
    if (password !== confirm) return setErr("Passwords don't match.");
    setBusy(true);
    try {
      const record = await createMnemonicWallet(name, password);
      if (enableBio) {
        try {
          await enrollPasskey(record.id, password, name);
        } catch (e) {
          console.warn("passkey enrollment failed (non-fatal):", e);
        }
      }
      onDone(record, password);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <BackHeader title="Create wallet" onBack={onBack} />
      <div>
        <label className="label">Wallet name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <PasswordInput label="Password (8+ chars)" value={password} onChange={setPassword} placeholder="••••••••" showStrength />
      <PasswordInput label="Confirm password" value={confirm} onChange={setConfirm} placeholder="••••••••" onEnter={go} />
      {isPasskeySupported() && (
        <label className="flex items-center gap-2 text-xs text-dim cursor-pointer select-none">
          <input type="checkbox" checked={enableBio} onChange={(e) => setEnableBio(e.target.checked)} className="accent-accent" />
          Enable biometric unlock (Touch ID / Windows Hello)
        </label>
      )}
      {err && <div className="text-xs text-danger">{err}</div>}
      <button className="btn w-full mt-2" onClick={go} disabled={busy}>{busy ? "Creating…" : "Create wallet"}</button>
      <p className="text-[11px] text-dim mt-2">After creating, back up your seed phrase from the Wallets tab. Without it you can't restore.</p>
    </div>
  );
}

function UnlockForm({
  wallets,
  onUnlocked,
  onForgot,
  onCreateNew
}: {
  wallets: WalletRecord[];
  onUnlocked: (w: WalletRecord, pw: string) => void;
  onForgot: () => void;
  onCreateNew: () => void;
}) {
  const [walletId, setWalletId] = useState(wallets[0]?.id ?? "");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [bioAvailable, setBioAvailable] = useState(false);

  useEffect(() => {
    setBioAvailable(isPasskeySupported() && hasPasskeyFor(walletId));
  }, [walletId]);

  const wallet = wallets.find((w) => w.id === walletId);

  async function unlock(pw: string, opts: { fromPasskey?: boolean } = {}) {
    if (!wallet) return;
    setErr(null);
    setBusy(true);
    try {
      await unlockWallet(wallet, pw); // verifies the password is correct
      if (remember && !opts.fromPasskey && isPasskeySupported() && !hasPasskeyFor(wallet.id)) {
        try { await enrollPasskey(wallet.id, pw, wallet.name); } catch (e) { console.warn("enroll failed:", e); }
      }
      onUnlocked(wallet, pw);
    } catch {
      setErr("Wrong password.");
      setBusy(false);
    }
  }

  async function bioUnlock() {
    if (!wallet) return;
    setErr(null);
    setBusy(true);
    try {
      const pw = await unlockWithPasskey(wallet.id);
      await unlock(pw, { fromPasskey: true });
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Welcome back</h2>
      {wallets.length > 1 && (
        <div>
          <label className="label">Wallet</label>
          <select className="input" value={walletId} onChange={(e) => setWalletId(e.target.value)}>
            {wallets.map((w) => <option key={w.id} value={w.id}>{w.name} — {w.address.slice(0, 8)}…</option>)}
          </select>
        </div>
      )}
      {wallet && (
        <div className="text-xs text-dim font-mono bg-bg/60 rounded-md px-3 py-2 border border-border break-all">
          {wallet.address}
        </div>
      )}
      <PasswordInput label="Password" value={password} onChange={setPassword} placeholder="••••••••" autoFocus onEnter={() => unlock(password)} />
      <label className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-2 text-dim cursor-pointer select-none">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="accent-accent" />
          Remember me {isPasskeySupported() && <span className="text-dim/70">(via biometric)</span>}
        </span>
        <button type="button" onClick={onForgot} className="text-accent hover:underline">Forgot password?</button>
      </label>
      {err && <div className="text-xs text-danger">{err}</div>}
      <button className="btn w-full mt-2" onClick={() => unlock(password)} disabled={busy || !password}>
        {busy ? "Unlocking…" : "Unlock"}
      </button>
      {bioAvailable && (
        <button className="btn-secondary w-full" onClick={bioUnlock} disabled={busy}>
          🔒 Unlock with biometric
        </button>
      )}
      <button onClick={onCreateNew} className="text-xs text-dim hover:text-text mt-3 block w-full text-center">
        + Add another wallet
      </button>
    </div>
  );
}

function RestoreForm({ onBack, onDone }: { onBack: () => void; onDone: (r: WalletRecord, pw: string) => void }) {
  const [type, setType] = useState<"mnemonic" | "pk">("mnemonic");
  const [name, setName] = useState("Restored wallet");
  const [secret, setSecret] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  async function go() {
    setErr(null);
    if (!secret || password.length < 8) return setErr("Secret + 8+ char password required.");
    setBusy(true);
    try {
      const record = type === "mnemonic"
        ? await importMnemonicWallet(name, secret, password)
        : await importPrivateKeyWallet(name, secret, password);
      onDone(record, password);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <BackHeader title="Restore wallet" onBack={onBack} />
      <div className="text-xs text-dim bg-warning/10 border border-warning/30 rounded-md p-3">
        ℹ Wallet passwords can't be reset by anyone — that's the trade-off for self-custody.
        Restore from your seed phrase or private key backup to get a new password.
      </div>
      <div className="flex gap-2">
        <button onClick={() => setType("mnemonic")} className={`flex-1 px-3 py-2 rounded-md text-sm border ${type === "mnemonic" ? "border-accent bg-accent/10 text-accent" : "border-border text-dim hover:text-text"}`}>Seed phrase</button>
        <button onClick={() => setType("pk")} className={`flex-1 px-3 py-2 rounded-md text-sm border ${type === "pk" ? "border-accent bg-accent/10 text-accent" : "border-border text-dim hover:text-text"}`}>Private key</button>
      </div>
      <div>
        <label className="label">Wallet name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="label !mb-0">{type === "mnemonic" ? "Seed phrase (12 or 24 words)" : "Private key (0x…)"}</label>
          <button type="button" onClick={() => setScanning(true)} className="text-xs text-accent hover:underline">Scan QR</button>
        </div>
        <textarea className="input font-mono text-xs" rows={3} value={secret} onChange={(e) => setSecret(e.target.value)} />
      </div>
      <PasswordInput label="New password (8+ chars)" value={password} onChange={setPassword} showStrength onEnter={go} />
      {err && <div className="text-xs text-danger">{err}</div>}
      <button className="btn w-full mt-2" onClick={go} disabled={busy}>{busy ? "Restoring…" : "Restore wallet"}</button>
      {scanning && (
        <QrScanModal
          title={type === "mnemonic" ? "Scan seed phrase QR" : "Scan private key QR"}
          hint="Make sure no one else can see your screen — this secret controls the wallet."
          onScan={(text) => {
            const trimmed = text.trim();
            if (type === "pk" && !/^(0x)?[a-fA-F0-9]{64}$/.test(trimmed.replace(/^0x/, ""))) return false;
            if (type === "mnemonic" && trimmed.split(/\s+/).length < 12) return false;
            setSecret(trimmed);
            return true;
          }}
          onClose={() => setScanning(false)}
        />
      )}
    </div>
  );
}

function BackHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <button onClick={onBack} className="text-dim hover:text-text">←</button>
      <h2 className="text-lg font-semibold">{title}</h2>
    </div>
  );
}
