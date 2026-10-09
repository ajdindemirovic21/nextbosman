"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";

type Props = {
  lang: Locale;
  dict: Dictionary;
  profileOpen: boolean;
  onProfile: () => void;
};

function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

function IconChat() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 19l2.5-2.5H18a3 3 0 003-3V7a3 3 0 00-3-3H6a3 3 0 00-3 3v10z" />
    </svg>
  );
}

function IconLists() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />
    </svg>
  );
}

function IconProfile() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 19.5c1.5-3 4-4.5 7-4.5s5.5 1.5 7 4.5" />
    </svg>
  );
}

const itemClass = (active: boolean) =>
  `flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-semibold tracking-wide ${
    active ? "text-emerald-400" : "text-slate-400"
  }`;

export function BottomNav({ lang, dict, profileOpen, onProfile }: Props) {
  const pathname = usePathname();
  const [hash, setHash] = useState("");

  useEffect(() => {
    const sync = () => setHash(window.location.hash);
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [pathname]);

  const onSearch = pathname.includes("/search") && hash !== "#paste";
  const onPaste = pathname.includes("/search") && hash === "#paste";
  const onLists = pathname.includes("/lists");

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-slate-800/80 bg-slate-950/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:!hidden"
      aria-label={dict.nav.search}
    >
      <Link className={itemClass(onSearch && !profileOpen)} href={`/${lang}/search`}>
        <IconSearch />
        {dict.nav.search}
      </Link>
      <Link className={itemClass(onPaste && !profileOpen)} href={`/${lang}/search#paste`}>
        <IconChat />
        {dict.nav.parser}
      </Link>
      <Link className={itemClass(onLists && !profileOpen)} href={`/${lang}/lists`}>
        <IconLists />
        {dict.nav.lists}
      </Link>
      <button type="button" className={itemClass(profileOpen)} onClick={onProfile}>
        <IconProfile />
        {dict.nav.profile}
      </button>
    </nav>
  );
}
