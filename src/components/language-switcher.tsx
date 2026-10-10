"use client";

import { usePathname, useRouter } from "next/navigation";
import { localeLabels, locales, type Locale } from "@/i18n/config";

type Props = {
  current: Locale;
};

export function LanguageSwitcher({ current }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <label className="lang-switch relative inline-flex shrink-0">
      <span className="sr-only">Language</span>
      <select
        className="min-h-10 min-w-[7.5rem] max-w-full appearance-none rounded-lg border border-slate-500 bg-slate-800 py-2 pl-3 pr-8 text-sm font-medium text-white focus:border-emerald-500 focus:outline-none"
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

export function LanguageSwitcherFallback({ current }: Props) {
  return (
    <label className="lang-switch relative inline-flex shrink-0">
      <span className="sr-only">Language</span>
      <select
        className="min-h-10 min-w-[7.5rem] max-w-full appearance-none rounded-lg border border-slate-500 bg-slate-800 py-2 pl-3 pr-8 text-sm font-medium text-white"
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
