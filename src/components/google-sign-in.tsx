"use client";

import { usePathname } from "next/navigation";
import { IconGoogle } from "@/components/icons";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";

type Props = {
  lang: Locale;
  dict: Dictionary;
  compact?: boolean;
};

export function GoogleSignIn({ lang, dict, compact }: Props) {
  const pathname = usePathname() || `/${lang}`;

  function startGoogle() {
    const params = new URLSearchParams({
      next: pathname,
      origin: window.location.origin,
    });
    window.location.assign(`/api/auth/google?${params.toString()}`);
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={startGoogle}
        className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-500 bg-white px-2.5 py-2 text-sm font-medium text-slate-900 no-underline hover:bg-slate-100"
        aria-label={dict.account.googleContinue}
      >
        <IconGoogle className="h-4 w-4" />
        <span className="hidden sm:inline">{dict.account.google}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={startGoogle}
      className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-500 bg-white px-3 py-2 text-sm font-medium text-slate-900 no-underline hover:bg-slate-100"
    >
      <IconGoogle className="h-4 w-4" />
      {dict.account.googleContinue}
    </button>
  );
}
