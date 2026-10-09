export const locales = ["en", "es", "de", "fr", "pt", "tr", "it", "bs", "hr"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const localeLabels: Record<Locale, string> = {
  en: "English",
  es: "Español",
  de: "Deutsch",
  fr: "Français",
  pt: "Português",
  tr: "Türkçe",
  it: "Italiano",
  bs: "Bosanski",
  hr: "Hrvatski",
};

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
