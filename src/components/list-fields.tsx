"use client";

import type { Dictionary } from "@/i18n/get-dictionary";

type Props = {
  dict: Dictionary;
  title: string;
  club: string;
  disabled?: boolean;
  onTitleChange: (value: string) => void;
  onClubChange: (value: string) => void;
};

export function ListFields({ dict, title, club, disabled, onTitleChange, onClubChange }: Props) {
  return (
    <div className="grid gap-2">
      <label className="grid gap-1 text-xs text-slate-400">
        <span>{dict.account.listTitle}</span>
        <input
          className="min-h-11 rounded-lg border border-slate-800 bg-slate-950 px-3 text-sm text-white"
          value={title}
          disabled={disabled}
          autoComplete="off"
          onChange={(event) => onTitleChange(event.target.value)}
        />
      </label>
      <label className="grid gap-1 text-xs text-slate-400">
        <span>{dict.account.listClub}</span>
        <input
          className="min-h-11 rounded-lg border border-slate-800 bg-slate-950 px-3 text-sm text-white"
          value={club}
          disabled={disabled}
          autoComplete="off"
          onChange={(event) => onClubChange(event.target.value)}
        />
      </label>
      <p className="text-xs text-slate-500">{dict.account.listClubHint}</p>
    </div>
  );
}
