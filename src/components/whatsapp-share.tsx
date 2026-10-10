"use client";

import { useState } from "react";
import { IconWhatsApp } from "@/components/icons";
import type { Player } from "@/data/mock-players";
import type { Dictionary } from "@/i18n/get-dictionary";
import { playerWhatsAppShare } from "@/lib/highlights";

type Props = {
  player: Player;
  dict: Dictionary;
  locale: string;
};

export function WhatsAppShare({ player, dict, locale }: Props) {
  const [copied, setCopied] = useState(false);
  const text = playerWhatsAppShare(player, dict, locale);
  const href = `https://wa.me/?text=${encodeURIComponent(text)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="share-row">
      <a className="wa-btn inline-flex min-h-12 items-center justify-center gap-2" href={href} target="_blank" rel="noopener noreferrer">
        <IconWhatsApp className="h-4 w-4" />
        {dict.profile.shareWhatsApp}
      </a>
      <button type="button" className="btn-ghost share-copy" onClick={() => void copy()}>
        {copied ? dict.profile.copied : dict.profile.copyShare}
      </button>
    </div>
  );
}
