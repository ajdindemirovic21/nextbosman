export function formatMarketValue(value: number, locale: string): string {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    const compact = millions >= 10 ? millions.toFixed(0) : millions.toFixed(1).replace(/\.0$/, "");
    return `€${compact}m`;
  }
  if (value >= 1_000) {
    return `€${Math.round(value / 1_000)}k`;
  }
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Always DD.MM.YYYY. — avoids locale short-month glitches like "1996 M12 4". */
export function formatDate(iso: string, _locale?: string): string {
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(iso.trim());
  if (!match) return iso || "—";
  const day = match[3].padStart(2, "0");
  const month = match[2].padStart(2, "0");
  return `${day}.${month}.${match[1]}.`;
}
