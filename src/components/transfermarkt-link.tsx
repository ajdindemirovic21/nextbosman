import type { Dictionary } from "@/i18n/get-dictionary";
import { parseTransfermarktProfileUrl } from "@/lib/profile-url";

type Props = {
  profileUrl: string | null;
  playerId: string;
  dict: Dictionary;
  compact?: boolean;
};

export function TransfermarktLink({ profileUrl, playerId, dict, compact }: Props) {
  const href = parseTransfermarktProfileUrl(profileUrl, playerId);
  if (!href) return null;

  return (
    <a
      className={compact ? "tm-link" : "tm-btn"}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {dict.profile.transfermarktProfile}
    </a>
  );
}
