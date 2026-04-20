"use client";
import { useEffect, useRef, useState } from "react";

type Props = {
  title: string;
  hint?: string;
  // Return false to keep scanning (e.g., wrong format), true/void to close.
  onScan: (text: string) => boolean | void | Promise<boolean | void>;
  onClose: () => void;
};

export function QrScanModal({ title, hint, onScan, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [lastText, setLastText] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // Lazy load to avoid pulling the camera bundle into the initial chunk.
        const QrScanner = (await import("qr-scanner")).default;
        if (cancelled || !videoRef.current) return;

        const scanner = new QrScanner(
          videoRef.current,
          async (result) => {
            const text = result.data;
            if (!text || text === lastText) return;
            setLastText(text);
            try {
              const keep = await onScan(text);
              if (keep !== false) {
                scanner.stop();
                onClose();
              }
            } catch (e) {
              setError(e instanceof Error ? e.message : "scan handler error");
            }
          },
          { highlightScanRegion: true, highlightCodeOutline: true, preferredCamera: "environment" }
        );
        scannerRef.current = scanner;
        await scanner.start();
        setCameraReady(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "camera unavailable");
      }
    })();

    return () => {
      cancelled = true;
      const s = scannerRef.current as { stop?: () => void; destroy?: () => void } | null;
      s?.stop?.();
      s?.destroy?.();
    };
  }, [onScan, onClose, lastText]);

  return (
    <div className="modal-bg">
      <div className="modal max-w-md">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold">{title}</h3>
          <button onClick={onClose} className="text-dim hover:text-text">✕</button>
        </div>
        {hint && <p className="text-xs text-dim mb-3">{hint}</p>}
        <div className="relative aspect-square bg-bg rounded-lg overflow-hidden border border-border">
          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline />
          {!cameraReady && !error && (
            <div className="absolute inset-0 flex items-center justify-center text-dim text-sm">Starting camera…</div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center text-danger text-sm p-4 text-center">
              {error}
              <br /><br />
              Allow camera access in your browser, then reopen.
            </div>
          )}
        </div>
        <p className="text-[11px] text-dim mt-3 text-center">Point at a QR code. Camera frames stay on this device.</p>
      </div>
    </div>
  );
}
