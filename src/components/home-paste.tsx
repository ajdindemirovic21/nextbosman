"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import { PASTE_STORAGE_KEY, parseWhatsAppPaste } from "@/lib/paste-parser";

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
    const query = new URLSearchParams();
    query.set("status", parsed.availability ?? "free");
    if (parsed.positions.length) query.set("position", parsed.positions.join(","));
    if (parsed.euPassport) query.set("eu", "1");
    router.push(`/${lang}/search?${query}`);
  }

  return (
    <section
      className="home-paste w-full rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4 shadow-xl backdrop-blur-md md:p-6"
      aria-labelledby="home-paste-title"
    >
      <p className="kicker text-xs font-semibold uppercase tracking-wider text-emerald-400">
        {dict.paste.title}
      </p>
      <h2 id="home-paste-title" className="text-2xl font-bold tracking-tight text-white">
        {dict.home.pasteHeadline}
      </h2>
      <p className="home-paste-lead">{dict.paste.hint}</p>
      <textarea
        className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={dict.paste.placeholder}
        rows={6}
      />
      <button type="button" className="btn-primary" onClick={run} disabled={!text.trim()}>
        {dict.paste.apply}
      </button>
    </section>
  );
}
