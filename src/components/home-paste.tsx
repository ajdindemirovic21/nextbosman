"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import {
  PASTE_STORAGE_KEY,
  catalogFiltersFromPaste,
  parseWhatsAppPaste,
  pasteHasRecognizedNeeds,
} from "@/lib/paste-parser";

type Props = {
  lang: Locale;
  dict: Dictionary;
};

export function HomePaste({ lang, dict }: Props) {
  const router = useRouter();
  const [text, setText] = useState("");

  function run() {
    const parsed = parseWhatsAppPaste(text);
    if (text.trim()) {
      sessionStorage.setItem(PASTE_STORAGE_KEY, text.trim());
    }
    if (!pasteHasRecognizedNeeds(parsed)) {
      router.push(`/${lang}/search`);
      return;
    }
    const filters = catalogFiltersFromPaste(parsed);
    const query = new URLSearchParams();
    query.set("status", filters.status ?? "all");
    if (filters.positions !== "all") query.set("position", filters.positions.join(","));
    if (filters.euOnly) query.set("eu", "1");
    if (filters.minAge) query.set("minAge", String(filters.minAge));
    if (filters.maxAge) query.set("maxAge", String(filters.maxAge));
    if (filters.maxMv !== "any") query.set("maxMv", String(filters.maxMv));
    router.push(`/${lang}/search?${query}`);
  }

  return (
    <section
      className="home-paste box-border w-full min-w-0 max-w-full rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4 shadow-xl backdrop-blur-md md:p-6"
      aria-labelledby="home-paste-title"
    >
      <p className="kicker text-xs font-semibold uppercase tracking-wider text-emerald-400">
        {dict.paste.title}
      </p>
      <h2
        id="home-paste-title"
        className="text-xl font-bold tracking-tight break-words text-white sm:text-2xl"
      >
        {dict.home.pasteHeadline}
      </h2>
      <p className="home-paste-lead break-words">{dict.paste.hint}</p>
      <textarea
        className="box-border max-w-full min-w-0 w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-3 text-sm leading-6 text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none sm:px-4"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={dict.paste.placeholder}
        rows={6}
      />
      <button type="button" className="btn-primary max-w-full" onClick={run} disabled={!text.trim()}>
        {dict.paste.apply}
      </button>
    </section>
  );
}
