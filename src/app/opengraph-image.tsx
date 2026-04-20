import { ImageResponse } from "next/og";

export const alt = "DeFi Wallet — self-custody multi-chain web wallet";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "radial-gradient(circle at 30% 30%, #1a1f3d 0%, #0a0d1a 50%, #050614 100%)",
          color: "white",
          fontFamily: "system-ui, sans-serif",
          padding: 80,
          position: "relative"
        }}
      >
        <div style={{ position: "absolute", inset: 0, opacity: 0.18, backgroundImage: "linear-gradient(#5b8cff 1px, transparent 1px), linear-gradient(90deg, #5b8cff 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 40 }}>
          <div style={{ width: 72, height: 72, borderRadius: 18, background: "linear-gradient(135deg, #5b8cff 0%, #7a3dff 60%, #ff3b9a 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44, fontWeight: 800 }}>◆</div>
          <div style={{ fontSize: 32, fontWeight: 600, letterSpacing: -0.5 }}>DeFi Wallet</div>
        </div>
        <div style={{ fontSize: 84, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2, marginBottom: 32, maxWidth: 1000 }}>
          Self-custody crypto wallet
          <br />
          <span style={{ background: "linear-gradient(90deg, #5b8cff, #7bf0c0)", WebkitBackgroundClip: "text", color: "transparent" }}>in your browser</span>
        </div>
        <div style={{ fontSize: 30, color: "#8a93a8", maxWidth: 900, lineHeight: 1.3 }}>
          Multi-chain · WalletConnect v2 · Biometric unlock · QR scan
        </div>
        <div style={{ position: "absolute", bottom: 60, left: 80, right: 80, display: "flex", gap: 12 }}>
          {["Ethereum", "Base", "Arbitrum", "Optimism", "Polygon", "BSC"].map((c) => (
            <div key={c} style={{ padding: "10px 18px", borderRadius: 999, background: "#1a2444", border: "1px solid #3a5da8", color: "#a5c0ff", fontSize: 22 }}>
              {c}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
