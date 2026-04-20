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
          background: "#0a0d1a",
          backgroundImage: "radial-gradient(circle at 30% 30%, #1a1f3d 0%, #0a0d1a 50%, #050614 100%)",
          color: "#ffffff",
          fontFamily: "system-ui, sans-serif",
          padding: "80px",
          position: "relative"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", marginBottom: 48 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 72,
              height: 72,
              borderRadius: 18,
              background: "#5b8cff",
              color: "#ffffff",
              fontSize: 44,
              fontWeight: 800,
              marginRight: 18
            }}
          >
            D
          </div>
          <div style={{ display: "flex", fontSize: 32, fontWeight: 600 }}>DeFi Wallet</div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 84,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: -2,
            marginBottom: 24,
            maxWidth: 1000
          }}
        >
          Self-custody crypto wallet
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 72,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: -2,
            marginBottom: 36,
            color: "#7bf0c0"
          }}
        >
          in your browser
        </div>

        <div style={{ display: "flex", fontSize: 30, color: "#8a93a8", maxWidth: 900, lineHeight: 1.3 }}>
          Multi-chain · WalletConnect v2 · Biometric unlock · QR scan
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 60,
            left: 80,
            right: 80,
            display: "flex",
            flexWrap: "wrap"
          }}
        >
          {["Ethereum", "Base", "Arbitrum", "Optimism", "Polygon", "BSC"].map((c) => (
            <div
              key={c}
              style={{
                display: "flex",
                padding: "10px 18px",
                marginRight: 12,
                borderRadius: 999,
                background: "#1a2444",
                border: "1px solid #3a5da8",
                color: "#a5c0ff",
                fontSize: 22
              }}
            >
              {c}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
