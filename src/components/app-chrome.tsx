"use client";

import Link from "next/link";
import { Suspense, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
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
  const headerRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const apply = () => {
      document.documentElement.style.setProperty("--app-header-height", `${el.offsetHeight}px`);
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!profileOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setProfileOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [profileOpen]);

  return (
    <>
      <header
        ref={headerRef}
        className="sticky top-0 z-50 bg-[var(--header)] pt-[max(0.5rem,env(safe-area-inset-top))]"
      >
        <div className="mx-auto flex max-w-[1180px] flex-nowrap items-center gap-2 px-[max(0.75rem,env(safe-area-inset-left))] py-2 pr-[max(0.75rem,env(safe-area-inset-right))] md:gap-3 md:px-6">
          <Link
            href={`/${lang}`}
            className="brand min-w-0 shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
          >
            <LogoMark />
            <span className="wordmark truncate text-[0.95rem] font-semibold tracking-tight text-white md:text-base">
              {dict.brand.name}
            </span>
          </Link>
          <div className="min-w-0 flex-1">
            <SiteNav lang={lang} dict={dict} />
          </div>
          <div className="ml-auto flex shrink-0 items-center justify-end gap-2 sm:gap-3">
            <Suspense fallback={<LanguageSwitcherFallback current={lang} label={dict.nav.language} />}>
              <LanguageSwitcher current={lang} label={dict.nav.language} />
            </Suspense>
            <AgentMenu lang={lang} dict={dict} />
          </div>
        </div>
      </header>
      <div className="shell min-w-0">{children}</div>
      {profileOpen ? (
        <div className="fixed inset-0 z-[60] md:!hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[var(--bg)]/70"
            aria-label={dict.profile.close}
            onClick={() => setProfileOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-[var(--bg-elev)] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="min-w-0 text-sm font-semibold text-white">{dict.nav.profile}</p>
              <button
                type="button"
                className="btn-secondary shrink-0"
                onClick={() => setProfileOpen(false)}
              >
                {dict.profile.close}
              </button>
            </div>
            <div className="mb-4">
              <Suspense fallback={<LanguageSwitcherFallback current={lang} label={dict.nav.language} />}>
                <LanguageSwitcher current={lang} label={dict.nav.language} />
              </Suspense>
            </div>
            <AgentMenu lang={lang} dict={dict} embedded />
            <Link
              href={`/${lang}/support`}
              className="btn-text mt-4 block"
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
