"use client";

import Link from "next/link";
import { Suspense, useState, type ReactNode } from "react";
import { AgentMenu } from "@/components/agent-menu";
import { BottomNav } from "@/components/bottom-nav";
import {
  LanguageSwitcher,
  LanguageSwitcherFallback,
} from "@/components/language-switcher";
import { LogoMark } from "@/components/logo-mark";
import { SiteNav } from "@/components/site-nav";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";

type Props = {
  lang: Locale;
  dict: Dictionary;
  children: ReactNode;
};

export function AppChrome({ lang, dict, children }: Props) {
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-2 px-[max(0.75rem,env(safe-area-inset-left))] py-2 pr-[max(0.75rem,env(safe-area-inset-right))] md:flex-nowrap md:px-6">
          <Link href={`/${lang}`} className="brand min-w-0 shrink-0">
            <LogoMark />
            <span className="wordmark truncate text-base font-bold tracking-tight text-white md:text-lg">
              {dict.brand.name}
            </span>
          </Link>
          <div className="order-3 w-full min-w-0 md:order-none md:mx-4 md:min-w-0 md:flex-1">
            <SiteNav lang={lang} dict={dict} />
          </div>
          <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2 md:flex-nowrap">
            <AgentMenu lang={lang} dict={dict} />
            <Suspense fallback={<LanguageSwitcherFallback current={lang} />}>
              <LanguageSwitcher current={lang} />
            </Suspense>
          </div>
        </div>
      </header>
      <div className="shell min-w-0">{children}</div>
      {profileOpen ? (
        <div className="fixed inset-0 z-[60] md:!hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/70"
            aria-label={dict.profile.close}
            onClick={() => setProfileOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border border-slate-800 bg-slate-950 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="min-w-0 text-sm font-semibold text-white">{dict.nav.profile}</p>
              <button
                type="button"
                className="shrink-0 rounded-lg border border-slate-800 px-3 py-2 text-sm text-slate-200"
                onClick={() => setProfileOpen(false)}
              >
                {dict.profile.close}
              </button>
            </div>
            <div className="mb-4">
              <Suspense fallback={<LanguageSwitcherFallback current={lang} />}>
                <LanguageSwitcher current={lang} />
              </Suspense>
            </div>
            <AgentMenu lang={lang} dict={dict} embedded />
            <Link
              href={`/${lang}/support`}
              className="mt-4 block text-sm text-emerald-400"
              onClick={() => setProfileOpen(false)}
            >
              {dict.nav.support}
            </Link>
          </div>
        </div>
      ) : null}
      <BottomNav
        lang={lang}
        dict={dict}
        profileOpen={profileOpen}
        onProfile={() => setProfileOpen((open) => !open)}
      />
    </>
  );
}
