"use client";
import { useId, useState } from "react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  showStrength?: boolean;
  autoFocus?: boolean;
  onEnter?: () => void;
  label?: string;
};

export function PasswordInput({ value, onChange, placeholder, showStrength, autoFocus, onEnter, label }: Props) {
  const [shown, setShown] = useState(false);
  const id = useId();
  const strength = scorePassword(value);

  return (
    <div>
      {label && <label htmlFor={id} className="label">{label}</label>}
      <div className="relative">
        <input
          id={id}
          className="input pr-10"
          type={shown ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
          autoComplete="new-password"
        />
        <button
          type="button"
          aria-label={shown ? "Hide password" : "Show password"}
          onClick={() => setShown((s) => !s)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-dim hover:text-text p-1"
        >
          {shown ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {showStrength && value.length > 0 && (
        <div className="mt-1.5">
          <div className="h-1 bg-elev2 rounded overflow-hidden">
            <div
              className="h-full transition-all duration-200"
              style={{
                width: `${(strength.score / 4) * 100}%`,
                background: strength.color
              }}
            />
          </div>
          <div className="text-[11px] text-dim mt-1">{strength.label}</div>
        </div>
      )}
    </div>
  );
}

function scorePassword(pw: string): { score: number; label: string; color: string } {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  const labels = ["Too weak", "Weak", "Okay", "Strong", "Very strong"];
  const colors = ["#ff6b6b", "#ff9f43", "#ffd166", "#7bf0c0", "#5b8cff"];
  return { score: s, label: labels[s], color: colors[s] };
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
