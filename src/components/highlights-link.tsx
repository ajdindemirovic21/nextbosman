import type { Dictionary } from "@/i18n/get-dictionary";
import { YoutubeIcon } from "@/components/youtube-icon";
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
      <YoutubeIcon size={compact ? 15 : 18} />
      <span>{dict.profile.watchVideo}</span>
    </a>
  );
}
