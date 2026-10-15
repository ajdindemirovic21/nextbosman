"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { IconSearch } from "@/components/icons";
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

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!text.trim()) return;
    run();
  }

  return (
    <form
      className="home-paste box-border w-full min-w-0 max-w-full"
      aria-labelledby="home-paste-title"
      onSubmit={onSubmit}
    >
      <label id="home-paste-title" htmlFor="home-paste-input" className="home-paste-label">
        {dict.home.pasteLabel}
      </label>
      <textarea
        id="home-paste-input"
        className="box-border max-w-full min-w-0 w-full rounded-xl bg-transparent px-3 py-2.5 text-base leading-6 text-slate-100 placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 sm:px-4 sm:text-sm"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={dict.home.exampleRequest}
        rows={2}
      />
      <div className="home-paste-actions flex max-w-full flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary home-paste-submit max-w-full" disabled={!text.trim()}>
          <IconSearch className="h-4 w-4" />
          {dict.home.findPlayers}
          <span aria-hidden="true">→</span>
        </button>
        <button
          type="button"
          className="btn-text max-w-full"
          onClick={() => setText(dict.home.exampleRequest)}
        >
          {dict.home.exampleCta}
        </button>
      </div>
    </form>
  );
}
