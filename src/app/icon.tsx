import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #5b8cff 0%, #7a3dff 60%, #ff3b9a 100%)",
          color: "white",
          fontWeight: 800,
          fontSize: 42,
          fontFamily: "system-ui, sans-serif",
          borderRadius: 14
        }}
      >
        ◆
      </div>
    ),
    { ...size }
  );
}
