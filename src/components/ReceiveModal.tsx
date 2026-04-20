"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";

type Props = {
  address: string;
  walletName: string;
  chainName: string;
  onClose: () => void;
};

export function ReceiveModal({ address, walletName, chainName, onClose }: Props) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    QRCode.toDataURL(address, {
      width: 280,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#0a0d1a", light: "#ffffff" }
    })
      .then(setDataUrl)
      .catch((e) => console.error("qr generate failed", e));
  }, [address]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold">Receive · {walletName}</h3>
          <button onClick={onClose} className="text-dim hover:text-text text-xl leading-none">×</button>
        </div>

        <p className="text-xs text-dim mb-3">
          Scan this code or copy the address. Only send <strong className="text-text">{chainName}</strong> assets — sending from other networks may lose your funds.
        </p>

        <div className="flex justify-center mb-4">
          <div className="p-3 bg-white rounded-xl">
            {dataUrl ? (
              <img src={dataUrl} alt="Wallet address QR" width={280} height={280} />
            ) : (
              <div className="w-[280px] h-[280px] flex items-center justify-center text-dim">Generating…</div>
            )}
          </div>
        </div>

        <div className="bg-bg/60 border border-border rounded-md p-2 font-mono text-[11px] break-all text-dim mb-3">
          {address}
        </div>

        <button className="btn w-full" onClick={copy}>
          {copied ? "✓ Copied" : "Copy address"}
        </button>
      </div>
    </div>
  );
}
