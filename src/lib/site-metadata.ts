import type { Metadata } from "next";
import { defaultLocale, locales, type Locale } from "@/i18n/config";
import { getConfiguredSiteUrl } from "@/lib/site-url";

const ogLocales: Record<Locale, string> = {
  en: "en_US",
  es: "es_ES",
  de: "de_DE",
  fr: "fr_FR",
  pt: "pt_PT",
  tr: "tr_TR",
  it: "it_IT",
  bs: "bs_BA",
  hr: "hr_HR",
};

export function localePath(lang: Locale, path = "") {
  const suffix = !path || path === "/" ? "" : path.startsWith("/") ? path : `/${path}`;
  return `/${lang}${suffix}`;
}

export function languageAlternates(path = "") {
  const languages: Record<string, string> = {};
  for (const lang of locales) {
    languages[lang] = localePath(lang, path);
  }
  languages["x-default"] = localePath(defaultLocale, path);
  return languages;
}

export function sitemapLanguageUrls(path = "") {
  const site = getConfiguredSiteUrl();
  const languages: Record<string, string> = {};
  for (const lang of locales) {
    languages[lang] = `${site}${localePath(lang, path)}`;
  }
  return languages;
}

type PageSeo = {
  title: string;
  description: string;
  path?: string;
  index?: boolean;
};

export function buildPageMetadata(lang: Locale, page: PageSeo): Metadata {
  const path = localePath(lang, page.path ?? "");
  const site = getConfiguredSiteUrl();
  return {
    title: page.title,
    description: page.description,
    robots:
      page.index === false
        ? { index: false, follow: false, googleBot: { index: false, follow: false } }
        : { index: true, follow: true },
    alternates: {
      canonical: path,
      languages: languageAlternates(page.path ?? ""),
    },
    openGraph: {
      type: "website",
      locale: ogLocales[lang],
      url: path,
      siteName: "NextBosman",
      title: page.title,
      description: page.description,
      images: [
        {
          url: `${site}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: "NextBosman — free agents and expiring contracts",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: page.title,
      description: page.description,
      images: [
        {
          url: `${site}/twitter-image`,
          width: 1200,
          height: 630,
          alt: "NextBosman — free agents and expiring contracts",
        },
      ],
    },
  };
}
