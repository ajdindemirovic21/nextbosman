import Link from "next/link";
import { IconLists, IconSearch } from "@/components/icons";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";

type Props = {
  lang: Locale;
  dict: Dictionary;
};

const navClass =
  "inline-flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm leading-snug text-slate-200 no-underline transition hover:bg-[var(--bg-elev)] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400";

export function SiteNav({ lang, dict }: Props) {
  return (
    <nav
      className="site-nav hidden min-w-0 items-center gap-0.5 overflow-x-auto md:flex [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      aria-label={dict.nav.search}
    >
      <Link className={navClass} href={`/${lang}/search`}>
        <IconSearch className="h-4 w-4 shrink-0 text-slate-400" />
        <span>{dict.nav.search}</span>
      </Link>
      <Link className={navClass} href={`/${lang}/lists`}>
        <IconLists className="h-4 w-4 shrink-0 text-slate-400" />
        <span>{dict.nav.lists}</span>
      </Link>
    </nav>
  );
}
