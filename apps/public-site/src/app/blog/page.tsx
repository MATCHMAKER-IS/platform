import * as React from "react";
import type { Metadata } from "next";
import { content, siteConfig } from "../../server/content";
import { SiteSidebar } from "../site-sidebar";
import { BeaconClient } from "../beacon-client";

export const metadata: Metadata = { title: "ブログ" };

export default async function BlogIndex() {
  const [posts, cats, counts, banner] = await Promise.all([
    content.posts(),
    content.categories(),
    content.categoryCounts(),
    content.pickBanner("/blog", "sidebar", () => 0),
  ]);
  const catItems = cats.filter((c) => !c.parentId).map((c) => ({ id: c.id, name: c.name, slug: c.slug, count: counts[c.id] ?? 0 }));
  return (
    <main className="mx-auto grid max-w-5xl grid-cols-1 gap-8 p-6 md:grid-cols-[1fr_16rem]">
      <div>
        <h1 className="mb-4 text-2xl font-bold">ブログ</h1>
        <ul className="flex flex-col gap-6">
          {posts.map((p) => (
            <li key={p.slug} className="flex flex-col gap-2 border-b border-neutral-100 pb-4">
              {p.eyecatch && <a href={`/blog/${p.slug}`}><img src={p.eyecatch} alt="" className="h-40 w-full rounded object-cover" loading="lazy" /></a>}
              <a href={`/blog/${p.slug}`} className="text-lg font-semibold hover:text-blue-700">{p.title}</a>
              <p className="text-xs text-neutral-500">{p.publishedAt.slice(0, 10)}</p>
              {p.excerpt && <p className="text-sm text-neutral-600">{p.excerpt}</p>}
            </li>
          ))}
        </ul>
      </div>
      <aside><SiteSidebar categories={catItems} banner={banner ? { id: banner.id, image: banner.image, href: banner.href, ...(banner.alt ? { alt: banner.alt } : {}), ...(banner.sponsored ? { sponsored: banner.sponsored } : {}) } : undefined} /></aside>
      <BeaconClient path="/blog" />
    </main>
  );
}
