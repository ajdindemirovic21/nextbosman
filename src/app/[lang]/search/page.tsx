import { SearchDesk } from "@/components/search-desk";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { notFound } from "next/navigation";
import { Suspense } from "react";

export default async function SearchPage({ params }: PageProps<"/[lang]/search">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <main className="page">
      <section className="hero hero-compact">
        <p className="kicker text-xs font-semibold uppercase tracking-wider text-emerald-400">
          {dict.hero.kicker}
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">{dict.search.title}</h1>
        <p className="lede">{dict.search.subtitle}</p>
      </section>
      <Suspense fallback={null}>
        <SearchDesk dict={dict} locale={lang} />
      </Suspense>
    </main>
  );
}
