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
    <label className="lang-switch">
      <span className="sr-only">Language</span>
      <select
        className="max-w-[9.5rem] whitespace-nowrap rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-1.5 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
        value={current}
        onChange={(event) => {
          const next = event.target.value as Locale;
          document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; SameSite=Lax`;
          const rest = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "") || "";
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
