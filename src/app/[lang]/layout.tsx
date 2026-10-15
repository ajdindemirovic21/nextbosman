import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { notFound } from "next/navigation";
import { AppChrome } from "@/components/app-chrome";
import { isLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { buildPageMetadata } from "@/lib/site-metadata";
import { getConfiguredSiteUrl } from "@/lib/site-url";
import "../globals.css";

const sans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin", "latin-ext"],
});

export async function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0B0F17",
  viewportFit: "cover",
};

export async function generateMetadata({
  params,
}: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    metadataBase: new URL(getConfiguredSiteUrl()),
    applicationName: dict.brand.name,
    appleWebApp: {
      capable: true,
      title: dict.brand.name,
      statusBarStyle: "black-translucent",
    },
    formatDetection: { telephone: false },
    ...buildPageMetadata(lang, {
      title: dict.meta.title,
      description: dict.meta.description,
    }),
    title: {
      default: dict.meta.title,
      template: `%s · ${dict.brand.name}`,
    },
  };
}

export default async function RootLayout({
  children,
  params,
}: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <html lang={lang} className={`${sans.className} ${sans.variable} h-full antialiased`}>
      <body className="min-h-full bg-[#0B0F17] text-slate-100">
        <AppChrome lang={lang} dict={dict}>
          {children}
          <footer className="site-foot">
            <p>{dict.footer.free}</p>
            <p>{dict.footer.live}</p>
          </footer>
        </AppChrome>
      </body>
    </html>
  );
}
