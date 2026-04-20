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
          background: "#5b8cff",
          color: "white",
          fontWeight: 800,
          fontSize: 42,
          fontFamily: "system-ui, sans-serif",
          borderRadius: 14
        }}
      >
        D
      </div>
    ),
    { ...size }
  );
}
