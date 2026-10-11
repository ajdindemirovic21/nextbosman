export const ogImageSize = { width: 1200, height: 630 };
export const ogContentType = "image/png";
export const ogAlt = "NextBosman — free agents and expiring contracts";

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
        background: "#0B0F17",
        color: "#f8fafc",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -120,
          left: 280,
          width: 640,
          height: 420,
          borderRadius: 999,
          background: "rgba(16, 185, 129, 0.16)",
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
        <div
          style={{
            width: 148,
            height: 148,
            borderRadius: 74,
            background: "#f8fafc",
            border: "6px solid #111111",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 46,
              height: 46,
              background: "#111111",
              transform: "rotate(18deg)",
            }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 22,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: "#34d399",
              fontWeight: 700,
            }}
          >
            For football agents
          </div>
          <div style={{ fontSize: 72, fontWeight: 800, letterSpacing: -2, lineHeight: 1.05 }}>
            NextBosman
          </div>
        </div>
      </div>
      <div
        style={{
          marginTop: 36,
          fontSize: 36,
          fontWeight: 700,
          lineHeight: 1.25,
          maxWidth: 920,
          color: "#e2e8f0",
        }}
      >
        The next Bosman is already out there.
      </div>
      <div style={{ marginTop: 16, fontSize: 24, color: "#94a3b8", maxWidth: 880 }}>
        Free agents and expiring contracts, worldwide.
      </div>
    </div>
  );
}
