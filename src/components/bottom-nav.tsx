"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { IconLists, IconProfile, IconSearch, IconWhatsApp } from "@/components/icons";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";

type Props = {
  lang: Locale;
  dict: Dictionary;
  profileOpen: boolean;
  onProfile: () => void;
};

const itemClass = (active: boolean) =>
  `flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-center text-[11px] font-semibold leading-tight tracking-wide focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-400 ${
    active ? "text-emerald-400" : "text-slate-300"
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
      className="fixed inset-x-0 bottom-0 z-40 hidden grid-cols-4 bg-[var(--header)] pb-[env(safe-area-inset-bottom)] max-md:grid"
      aria-label={dict.nav.search}
    >
      <Link className={itemClass(onSearch && !profileOpen)} href={`/${lang}/search`}>
        <IconSearch className="h-5 w-5" />
        {dict.nav.search}
      </Link>
      <Link className={itemClass(onPaste && !profileOpen)} href={`/${lang}/search#paste`}>
        <IconWhatsApp className="h-5 w-5" />
        {dict.nav.parser}
      </Link>
      <Link className={itemClass(onLists && !profileOpen)} href={`/${lang}/lists`}>
        <IconLists className="h-5 w-5" />
        {dict.nav.lists}
      </Link>
      <button type="button" className={itemClass(profileOpen)} onClick={onProfile}>
        <IconProfile className="h-5 w-5" />
        {dict.nav.profile}
      </button>
    </nav>
  );
}
