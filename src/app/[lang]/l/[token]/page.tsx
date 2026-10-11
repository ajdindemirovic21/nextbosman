import type { Metadata } from "next";
import { SharedListDesk } from "@/components/shared-list-desk";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { buildPageMetadata } from "@/lib/site-metadata";
import { loadSharedList } from "@/lib/shared-lists";
import { notFound } from "next/navigation";

export const instant = false;

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/l/[token]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return buildPageMetadata(lang, {
    title: dict.meta.sharedListTitle,
    description: dict.meta.sharedListDescription,
    path: "/l",
    index: false,
  });
}

export default async function SharedListPage({ params }: PageProps<"/[lang]/l/[token]">) {
  const { lang, token } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const list = await loadSharedList(token);
  if (!list) notFound();
  return <SharedListDesk lang={lang} dict={dict} list={list} />;
}
