import { ImageResponse } from "next/og";
import { NbMarkGraphic } from "@/components/logo-mark";

export const size = { width: 512, height: 512 };
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
          background: "#1a2330",
        }}
      >
        <NbMarkGraphic size={368} color="#eef3f8" />
      </div>
    ),
    { ...size },
  );
}
