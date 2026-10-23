export function toPlainText(raw: unknown, maxLength = 500): string {
  if (typeof raw !== "string") return "";
  const withoutTags = raw.replace(/<[^>]*>/g, " ");
  const collapsed = withoutTags.replace(/\s+/g, " ").trim();
  if (collapsed.length <= maxLength) return collapsed;
  return collapsed.slice(0, maxLength).trim();
}
