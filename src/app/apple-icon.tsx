import { ImageResponse } from "next/og";
import { NbMarkGraphic } from "@/components/logo-mark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1a2330",
        }}
      >
        <NbMarkGraphic size={132} color="#eef3f8" />
      </div>
    ),
    { ...size },
  );
}
