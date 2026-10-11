import { randomBytes } from "crypto";

export function createShareToken() {
  return randomBytes(24).toString("base64url");
}
