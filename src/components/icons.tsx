import type { ReactNode } from "react";

type IconProps = {
  className?: string;
};

const base = "h-4 w-4 shrink-0";

function Svg({ className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className ?? base}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function IconPlayers({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="9" cy="8" r="3" />
      <circle cx="16.5" cy="9" r="2.4" />
      <path d="M3.5 19c.7-3.2 3-5 5.5-5s4.8 1.8 5.5 5" />
      <path d="M14.2 14.2c1.7-.4 3.6.4 4.8 2.8" />
    </Svg>
  );
}

export function IconContract({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M8 3.5h6.2L19 8.3V20a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 017 20V5A1.5 1.5 0 018.5 3.5H8z" />
      <path d="M14 3.8V8h4.2" />
      <path d="M9.5 12.5h6M9.5 16h4.5" />
    </Svg>
  );
}

export function IconPassport({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="5" y="3.5" width="14" height="17" rx="2" />
      <circle cx="12" cy="11" r="3" />
      <path d="M8.5 18.2h7" />
    </Svg>
  );
}

export function IconPaste({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="6" y="5" width="12" height="15" rx="2" />
      <path d="M9 5.2V4.5A1.5 1.5 0 0110.5 3h3A1.5 1.5 0 0115 4.5v.7" />
      <path d="M9 11h6M9 14.5h4" />
    </Svg>
  );
}

export function IconMatch({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconSend({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4.5 12l15-7.5-4 16-4.2-6.3L4.5 12z" />
      <path d="M11.3 14.2L19.5 4.5" />
    </Svg>
  );
}

export function IconSearch({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16.2 16.2L20 20" />
    </Svg>
  );
}

export function IconWhatsApp({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M5 19.2l1.7-4.1A8 8 0 1112 20a8.2 8.2 0 01-3.7-.9L5 19.2z" />
      <path d="M9.2 9.4c.2-.6.4-.6.7-.6h.5c.2 0 .4.1.5.4l.6 1.5c.1.2 0 .4-.1.6l-.4.5c-.2.2-.2.4 0 .6.4.6 1.1 1.3 1.8 1.7.2.1.4.1.6-.1l.5-.4c.2-.2.4-.2.6 0l1.5.7c.3.1.4.3.4.5v.5c0 .3 0 .5-.6.7-1.2.4-3.2.1-5.3-1.8-1.8-1.7-2.4-3.6-2.3-4.9 0-.6.3-.8.6-.9z" />
    </Svg>
  );
}

export function IconLists({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M9 7h10M9 12h10M9 17h10" />
      <path d="M5 7h.01M5 12h.01M5 17h.01" />
    </Svg>
  );
}

export function IconProfile({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 19.2c1.2-3 3.6-4.5 7-4.5s5.8 1.5 7 4.5" />
    </Svg>
  );
}

export function IconSupport({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 11.2v5M12 8.2h.01" />
    </Svg>
  );
}

export function IconLink({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M9.5 13.5a4.2 4.2 0 006 0l2.2-2.2a4.2 4.2 0 10-6-6L10.5 6.5" />
      <path d="M14.5 10.5a4.2 4.2 0 00-6 0L6.3 12.7a4.2 4.2 0 106 6l1.2-1.2" />
    </Svg>
  );
}

export function IconGoogle({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? base} aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.74-.07-1.45-.19-2.13H12v4.03h5.38a4.6 4.6 0 01-2 3.02v2.5h3.23c1.89-1.74 2.99-4.3 2.99-7.42z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.97-.9 6.63-2.35l-3.23-2.5c-.9.6-2.05.96-3.4.96-2.61 0-4.82-1.76-5.61-4.13H3.06v2.58A10 10 0 0012 22z"
      />
      <path
        fill="#FBBC05"
        d="M6.39 13.98A6.01 6.01 0 016.08 12c0-.69.12-1.35.31-1.98V7.44H3.06A10 10 0 002 12c0 1.61.39 3.14 1.06 4.56l3.33-2.58z"
      />
      <path
        fill="#EA4335"
        d="M12 5.89c1.47 0 2.79.5 3.83 1.5l2.87-2.87C16.96 2.89 14.7 2 12 2A10 10 0 003.06 7.44l3.33 2.58C7.18 7.65 9.39 5.89 12 5.89z"
      />
    </svg>
  );
}

export function IconPlay({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="3.5" y="6" width="17" height="12" rx="3" />
      <path d="M10.2 9.4v5.2L15.4 12z" fill="currentColor" stroke="none" />
    </Svg>
  );
}
