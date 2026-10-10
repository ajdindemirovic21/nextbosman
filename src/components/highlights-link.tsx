import type { Dictionary } from "@/i18n/get-dictionary";
import { IconPlay } from "@/components/icons";
import { playerHighlightsUrl } from "@/lib/highlights";

type Props = {
  playerName: string;
  dict: Dictionary;
  compact?: boolean;
};

export function HighlightsLink({ playerName, dict, compact }: Props) {
  return (
    <a
      className={compact ? "yt-btn yt-btn-compact" : "yt-btn yt-btn-lg"}
      href={playerHighlightsUrl(playerName)}
      target="_blank"
      rel="noopener noreferrer"
    >
      <IconPlay className={compact ? "h-3.5 w-3.5" : "h-[18px] w-[18px]"} />
      <span>{dict.profile.watchVideo}</span>
    </a>
  );
}
