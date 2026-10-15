"use client";

import { usePathname, useRouter } from "next/navigation";
import { localeLabels, locales, type Locale } from "@/i18n/config";

type Props = {
  current: Locale;
  label: string;
};

export function LanguageSwitcher({ current, label }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <label className="lang-switch relative inline-flex max-w-[9.5rem] shrink-0">
      <span className="sr-only">{label}</span>
      <select
        className="min-h-10 w-full min-w-[6.75rem] appearance-none truncate rounded-lg bg-[var(--bg-row)] py-2 pl-2.5 pr-7 text-sm font-medium text-white"
        value={current}
        onChange={(event) => {
          const next = event.target.value as Locale;
          document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; SameSite=Lax`;
          const rest = (pathname || `/${current}`).replace(/^\/[a-z]{2}(?=\/|$)/, "") || "";
          router.push(`/${next}${rest}${window.location.search}`);
        }}
      >
        {locales.map((locale) => (
          <option key={locale} value={locale}>
            {localeLabels[locale]}
          </option>
        ))}
      </select>
    </label>
  );
}

export function LanguageSwitcherFallback({ current, label }: Props) {
  return (
    <label className="lang-switch relative inline-flex max-w-[9.5rem] shrink-0">
      <span className="sr-only">{label}</span>
      <select
        className="min-h-10 w-full min-w-[6.75rem] appearance-none truncate rounded-lg bg-[var(--bg-row)] py-2 pl-2.5 pr-7 text-sm font-medium text-white"
        value={current}
        disabled
      >
        {locales.map((locale) => (
          <option key={locale} value={locale}>
            {localeLabels[locale]}
          </option>
        ))}
      </select>
    </label>
  );
}
