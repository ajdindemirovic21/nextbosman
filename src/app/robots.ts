import type { MetadataRoute } from "next";
import { getConfiguredSiteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const site = getConfiguredSiteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/auth/", "/*/lists"],
    },
    sitemap: `${site}/sitemap.xml`,
  };
}
