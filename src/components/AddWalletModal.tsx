"use client";
import { useState } from "react";
import { createMnemonicWallet, importMnemonicWallet, importPrivateKeyWallet, type WalletRecord } from "@/lib/wallet/keystore";
import { PasswordInput } from "./PasswordInput";

type Mode = "create" | "mnemonic" | "pk";

type Props = {
  onDone: (record: WalletRecord, password: string) => void;
  onClose: () => void;
};

export function AddWalletModal({ onDone, onClose }: Props) {
  const [mode, setMode] = useState<Mode>("create");
  const [name, setName] = useState("");
  const [secret, setSecret] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function go() {
    setErr(null);
    if (!name.trim()) return setErr("Name required.");
    if (password.length < 8) return setErr("Password must be at least 8 characters.");
    if (mode === "create" && password !== confirm) return setErr("Passwords don't match.");
    if (mode !== "create" && !secret.trim()) return setErr(mode === "mnemonic" ? "Seed phrase required." : "Private key required.");

    setBusy(true);
    try {
      const record =
        mode === "create"
          ? await createMnemonicWallet(name.trim(), password)
          : mode === "mnemonic"
          ? await importMnemonicWallet(name.trim(), secret.trim(), password)
          : await importPrivateKeyWallet(name.trim(), secret.trim(), password);
      onDone(record, password);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold">Add wallet</h3>
          <button onClick={onClose} className="text-dim hover:text-text text-xl leading-none">×</button>
        </div>

        <div className="flex gap-1 mb-4 bg-bg/40 p-1 rounded-lg">
          <ModeBtn active={mode === "create"} onClick={() => setMode("create")}>+ New</ModeBtn>
          <ModeBtn active={mode === "mnemonic"} onClick={() => setMode("mnemonic")}>Seed phrase</ModeBtn>
          <ModeBtn active={mode === "pk"} onClick={() => setMode("pk")}>Private key</ModeBtn>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label className="label">Wallet name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={mode === "create" ? "Main wallet" : "Imported wallet"} />
          </div>

          {mode !== "create" && (
            <div>
              <label className="label">{mode === "mnemonic" ? "Seed phrase (12 or 24 words)" : "Private key (0x…)"}</label>
              <textarea className="input font-mono text-xs" rows={3} value={secret} onChange={(e) => setSecret(e.target.value)} />
            </div>
          )}

          <PasswordInput label={mode === "create" ? "Password (8+ chars)" : "New password (8+ chars)"} value={password} onChange={setPassword} placeholder="••••••••" showStrength />
          {mode === "create" && (
            <PasswordInput label="Confirm password" value={confirm} onChange={setConfirm} placeholder="••••••••" onEnter={go} />
          )}

          {err && <div className="text-xs text-danger">{err}</div>}
        </div>

        <div className="flex gap-2 mt-4 justify-end">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={go} disabled={busy}>{busy ? "Saving…" : "Add wallet"}</button>
        </div>
      </div>
    </div>
  );
}

function ModeBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-2 py-1.5 rounded-md text-xs transition ${active ? "bg-accent text-white" : "text-dim hover:text-text"}`}
    >
      {children}
    </button>
  );
}
