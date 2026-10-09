export function YoutubeIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className="yt-icon"
    >
      <rect x="1.5" y="5" width="21" height="14" rx="4" fill="#ff2d2d" />
      <path d="M10 9.2v5.6L15.4 12z" fill="#fff" />
    </svg>
  );
}
