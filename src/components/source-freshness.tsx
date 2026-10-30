import type { Player } from "@/data/mock-players";
import type { Dictionary } from "@/i18n/get-dictionary";
import { sourceFreshnessItems } from "@/lib/contract-display";

type Props = {
  player: Player;
  dict: Dictionary;
  locale: string;
  detail?: boolean;
  className?: string;
};

export function SourceFreshness({ player, dict, locale, detail = false, className }: Props) {
  const items = sourceFreshnessItems(player, dict, locale, detail);
  if (!items.length) return null;

  return (
    <>
      {items.map((item) =>
        item.href ? (
          <a
            key={`${item.text}:${item.href}`}
            className={className}
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            {item.text}
          </a>
        ) : (
          <span className={className} key={item.text}>
            {item.text}
          </span>
        ),
      )}
    </>
  );
}
