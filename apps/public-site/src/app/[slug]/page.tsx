import * as React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { breadcrumbFromMenu } from "@platform/site";
import { content, siteConfig } from "../../server/content";
import { renderPage } from "../../server/site-content";
import { pageMeta } from "../../server/seo";
import { BlockRenderer } from "../block-renderer";
import { BeaconClient } from "../beacon-client";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await content.page(slug);
  if (!page) return {};
  const meta = pageMeta(page, siteConfig);
  return { title: meta.title, description: meta.tags.find((t) => t.name === "description")?.content };
}

export default async function DynamicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await content.page(slug);
  if (!page) notFound();
  const blocks = renderPage(page);
  const menu = await content.menu();
  const crumbs = breadcrumbFromMenu(menu, `/${slug}`);
  const announcements = await content.announcements(`/${slug}`);
  return (
    <main className="mx-auto max-w-3xl p-6">
      <nav className="mb-4 text-xs text-neutral-500">
        {crumbs.map((c, i) => (
          <span key={c.href}>{i > 0 && " / "}<a href={c.href}>{c.label}</a></span>
        ))}
      </nav>
      {announcements.map((a) => (
        <div key={a.id} className="mb-4 rounded bg-blue-50 px-3 py-2 text-sm text-blue-900">{a.message}</div>
      ))}
      <h1 className="mb-4 text-2xl font-bold">{page.title}</h1>
      <BlockRenderer blocks={blocks} />
      <BeaconClient path={`/${slug}`} />
    </main>
  );
}
