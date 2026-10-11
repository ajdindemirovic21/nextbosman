const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,64}$/;

export function isShareToken(value: string) {
  return SHARE_TOKEN_PATTERN.test(value);
}

export function sharedListPath(lang: string, token: string) {
  return `/${lang}/l/${encodeURIComponent(token)}`;
}
