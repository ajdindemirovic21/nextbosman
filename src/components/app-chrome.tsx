"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { AgentMenu } from "@/components/agent-menu";
import { BottomNav } from "@/components/bottom-nav";
import { LanguageSwitcher } from "@/components/language-switcher";
import { LogoMark } from "@/components/logo-mark";
import { SiteNav } from "@/components/site-nav";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";

type Props = {
  lang: Locale;
  dict: Dictionary;
  children: React.ReactNode;
};

export function AppChrome({ lang, dict, children }: Props) {
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-lg">
        <div className="topbar mx-auto flex max-w-[1180px] items-center justify-between px-4 py-3 md:px-6">
          <Link href={`/${lang}`} className="brand">
            <LogoMark />
            <span className="wordmark text-lg font-bold tracking-tight text-white">
              {dict.brand.name}
            </span>
          </Link>
          <div className="topbar-end flex">
            <div className="!hidden md:!flex">
              <SiteNav lang={lang} dict={dict} />
            </div>
            <AgentMenu lang={lang} dict={dict} />
            <div className="!hidden md:!flex">
              <Suspense fallback={null}>
                <LanguageSwitcher current={lang} />
              </Suspense>
            </div>
          </div>
        </div>
      </header>
      <div className="shell">{children}</div>
      {profileOpen ? (
        <div className="fixed inset-0 z-50 md:!hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/70"
            aria-label={dict.profile.close}
            onClick={() => setProfileOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border border-slate-800 bg-slate-950 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-white">{dict.nav.profile}</p>
              <button
                type="button"
                className="rounded-lg border border-slate-800 px-3 py-2 text-sm text-slate-200"
                onClick={() => setProfileOpen(false)}
              >
                {dict.profile.close}
              </button>
            </div>
            <div className="mb-4">
              <Suspense fallback={null}>
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
