import * as React from "react";
import type { Metadata } from "next";
import { content, siteConfig } from "../server/content";
import { renderPage } from "../server/site-content";
import { pageMeta } from "../server/seo";
import { BlockRenderer } from "./block-renderer";
import { BeaconClient } from "./beacon-client";

export async function generateMetadata(): Promise<Metadata> {
  const page = await content.page("");
  if (!page) return {};
  const meta = pageMeta(page, siteConfig);
  return { title: meta.title, description: meta.tags.find((t) => t.name === "description")?.content };
}

export default async function HomePage() {
  const page = await content.page("");
  if (!page) return <main>ページがありません</main>;
  const blocks = renderPage(page);
  const announcements = await content.announcements("/");
  return (
    <main className="mx-auto max-w-3xl p-6">
      {announcements.map((a) => (
        <div key={a.id} className="mb-4 rounded bg-blue-50 px-3 py-2 text-sm text-blue-900">{a.message}</div>
      ))}
      <BlockRenderer blocks={blocks} />
      <BeaconClient path="/" />
    </main>
  );
}
