import { ImageResponse } from "next/og";

/* Full-bleed square: the phone rounds the corners. The symbol stays inside the maskable safe zone. */
export function appIcon(size: number) {
  const symbol = Math.round(size * 0.6);
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#21614d" }}>
      <svg width={symbol} height={symbol} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" />
        <path d="M14 3v6h6M8 13h8M8 17h5" />
      </svg>
    </div>,
    { width: size, height: size },
  );
}
