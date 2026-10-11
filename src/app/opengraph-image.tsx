import { ImageResponse } from "next/og";
import { ogAlt, ogContentType, ogImageSize, OgShareImage } from "@/components/og-share-image";

export const alt = ogAlt;
export const size = ogImageSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return new ImageResponse(<OgShareImage />, { ...ogImageSize });
}
