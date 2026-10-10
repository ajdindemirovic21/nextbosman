"use client";

import { useEffect, useState } from "react";
import { IconLink, IconWhatsApp } from "@/components/icons";
import type { Dictionary } from "@/i18n/get-dictionary";

type Props = {
  dict: Dictionary;
  path?: string;
  text?: string;
  accent?: boolean;
};

function resolveUrl(path?: string) {
  if (typeof window === "undefined") return path ?? "";
  if (!path) return window.location.href;
  return new URL(path, window.location.origin).href;
}

export function QuickShare({ dict, path, text, accent }: Props) {
  const [copied, setCopied] = useState(false);
  const [waHref, setWaHref] = useState("https://wa.me/");
  const btn =
    accent
      ? "inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-900/20 bg-emerald-950/10 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-950 no-underline"
      : "inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950/60 px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 no-underline";

  useEffect(() => {
    const url = resolveUrl(path);
    const message = text ? `${text}\n${url}` : url;
    setWaHref(`https://wa.me/?text=${encodeURIComponent(message)}`);
  }, [path, text]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(resolveUrl(path));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex w-full min-w-0 gap-2" onClick={(event) => event.stopPropagation()}>
      <a
        className={btn}
        href={waHref}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(event) => event.stopPropagation()}
      >
        <IconWhatsApp className="h-3.5 w-3.5" />
        {dict.share.whatsapp}
      </a>
      <button type="button" className={btn} onClick={() => void copy()}>
        <IconLink className="h-3.5 w-3.5" />
        {copied ? dict.share.copied : dict.share.copy}
      </button>
    </div>
  );
}
