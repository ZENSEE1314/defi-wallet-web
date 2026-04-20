"use client";
import { useState } from "react";

type Props = {
  title: string;
  message: string;
  details?: string;
  onSubmit: (password: string) => void;
  onCancel: () => void;
};

export function PasswordPrompt({ title, message, details, onSubmit, onCancel }: Props) {
  const [pwd, setPwd] = useState("");
  return (
    <div className="modal-bg">
      <div className="modal">
        <h3 className="m-0 mb-3 text-base font-semibold">{title}</h3>
        <p className="text-dim text-sm mb-3">{message}</p>
        {details && <pre className="text-xs bg-bg border border-border rounded-md p-2 mb-3 overflow-auto max-h-40 whitespace-pre-wrap break-all">{details}</pre>}
        <input
          className="input"
          type="password"
          autoFocus
          placeholder="Wallet password"
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit(pwd)}
        />
        <div className="flex gap-2 mt-3 justify-end">
          <button className="btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn" onClick={() => onSubmit(pwd)}>Confirm</button>
        </div>
      </div>
    </div>
  );
}
