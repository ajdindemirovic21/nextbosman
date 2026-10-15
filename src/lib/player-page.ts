export const PAGE_SIZE = 80;

export function catalogIdKey(id: unknown): string {
  return String(id ?? "");
}

export function parsePageParam(raw: string | null | undefined): number {
  if (raw == null || raw.trim() === "") return 1;
  if (!/^[0-9]+$/.test(raw.trim())) return 1;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 1) return 1;
  return Math.min(Math.floor(value), 1_000_000);
}

export function compareCatalogIds(a: unknown, b: unknown): number {
  const left = catalogIdKey(a);
  const right = catalogIdKey(b);
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function compareMarketValueThenId(
  a: { id: unknown; marketValueEur: number },
  b: { id: unknown; marketValueEur: number },
): number {
  const mv = (Number(b.marketValueEur) || 0) - (Number(a.marketValueEur) || 0);
  if (mv !== 0) return mv;
  return compareCatalogIds(a.id, b.id);
}

export function pageOffset(page: number, pageSize = PAGE_SIZE): number {
  return (Math.max(1, page) - 1) * pageSize;
}
