import Link from "next/link";
import { IconContract, IconPlayers, IconSupport } from "@/components/icons";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";

type Props = {
  lang: Locale;
  dict: Dictionary;
};

const navClass =
  "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm text-slate-300 no-underline transition hover:bg-slate-800/60 hover:text-white";

export function SiteNav({ lang, dict }: Props) {
  return (
    <nav
      className="site-nav flex min-w-0 items-center gap-0.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      aria-label={dict.nav.search}
    >
      <Link className={navClass} href={`/${lang}/search?status=free`}>
        <IconPlayers className="h-4 w-4 text-emerald-400" />
        {dict.nav.free}
      </Link>
      <Link className={navClass} href={`/${lang}/search?status=expiring`}>
        <IconContract className="h-4 w-4 text-emerald-400" />
        {dict.nav.expiring}
      </Link>
      <Link className={navClass} href={`/${lang}/support`}>
        <IconSupport className="h-4 w-4 text-emerald-400" />
        {dict.nav.support}
      </Link>
    </nav>
  );
}
