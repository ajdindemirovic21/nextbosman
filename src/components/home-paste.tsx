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
      className="home-paste box-border w-full min-w-0 max-w-full rounded-2xl bg-[var(--bg-elev)] p-3 md:p-5"
      aria-labelledby="home-paste-title"
    >
      <h2
        id="home-paste-title"
        className="text-lg font-semibold tracking-tight break-words text-[var(--text)] sm:text-xl"
      >
        {dict.home.pasteHeadline}
      </h2>
      <p className="home-paste-lead break-words">{dict.paste.hint}</p>
      <textarea
        className="box-border max-w-full min-w-0 w-full rounded-xl bg-[var(--bg)] px-3 py-3 text-base leading-7 text-slate-100 placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 sm:px-4 sm:text-sm sm:leading-6"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={dict.paste.placeholder}
        rows={5}
      />
      <div className="flex max-w-full flex-wrap items-center gap-3">
        <button type="button" className="btn-primary max-w-full" onClick={run} disabled={!text.trim()}>
          {dict.paste.apply}
        </button>
        <button
          type="button"
          className="btn-text max-w-full"
          onClick={() => setText(dict.home.exampleRequest)}
        >
          {dict.home.exampleCta}
        </button>
      </div>
    </section>
  );
}
