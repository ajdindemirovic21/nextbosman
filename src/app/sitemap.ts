import type { MetadataRoute } from "next";
import { defaultLocale } from "@/i18n/config";
import { getConfiguredSiteUrl } from "@/lib/site-url";
import { localePath, sitemapLanguageUrls } from "@/lib/site-metadata";

const publicPaths = ["", "/search", "/support"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const site = getConfiguredSiteUrl();

  return publicPaths.map((path) => ({
    url: `${site}${localePath(defaultLocale, path)}`,
    changeFrequency: path === "" ? "daily" : "weekly",
    priority: path === "" ? 1 : path === "/search" ? 0.9 : 0.6,
    alternates: {
      languages: sitemapLanguageUrls(path),
    },
  }));
}
