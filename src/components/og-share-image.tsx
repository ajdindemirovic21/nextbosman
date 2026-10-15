import { NbMarkGraphic } from "@/components/logo-mark";

export const ogImageSize = { width: 1200, height: 630 };
export const ogContentType = "image/png";
export const ogAlt = "NextBosman — find players who match a club request";

export function OgShareImage() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "72px 80px",
        background: "#1a2330",
        color: "#eef3f8",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -140,
          left: 220,
          width: 720,
          height: 420,
          borderRadius: 999,
          background: "rgba(56, 82, 110, 0.28)",
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
        <NbMarkGraphic size={112} color="#eef3f8" />
        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            letterSpacing: -1.4,
            lineHeight: 1.05,
          }}
        >
          NextBosman
        </div>
      </div>
      <div
        style={{
          marginTop: 32,
          fontSize: 34,
          fontWeight: 600,
          lineHeight: 1.3,
          maxWidth: 880,
          color: "#c5d0dc",
        }}
      >
        Find players who match your club’s requirements.
      </div>
    </div>
  );
}
