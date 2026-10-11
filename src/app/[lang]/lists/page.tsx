import type { Metadata } from "next";
import { SavedListsDesk } from "@/components/saved-lists-desk";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { buildPageMetadata } from "@/lib/site-metadata";
import { notFound } from "next/navigation";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/lists">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return buildPageMetadata(lang, {
    title: dict.meta.listsTitle,
    description: dict.meta.listsDescription,
    path: "/lists",
    index: false,
  });
}

export default async function ListsPage({ params }: PageProps<"/[lang]/lists">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  return <SavedListsDesk lang={lang} dict={dict} />;
}
