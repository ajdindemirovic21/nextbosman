import Link from "next/link";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";

type Props = {
  lang: Locale;
  dict: Dictionary;
};

const navClass =
  "whitespace-nowrap rounded-lg px-3 py-1.5 text-sm text-slate-300 no-underline transition hover:bg-slate-800/60 hover:text-white";

export function SiteNav({ lang, dict }: Props) {
  return (
    <nav className="site-nav flex items-center gap-1" aria-label={dict.nav.search}>
      <Link className={navClass} href={`/${lang}/search?status=free`}>
        {dict.nav.free}
      </Link>
      <Link className={navClass} href={`/${lang}/search?status=expiring`}>
        {dict.nav.expiring}
      </Link>
      <Link className={navClass} href={`/${lang}/support`}>
        {dict.nav.support}
      </Link>
    </nav>
  );
}
