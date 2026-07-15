import * as React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { content, siteConfig } from "../../../../server/content.js";
import { SiteSidebar } from "../../../site-sidebar.js";
import { BeaconClient } from "../../../beacon-client.js";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const cat = await content.categoryBySlug(slug);
  return { title: cat ? `${cat.name}の記事` : "カテゴリ" };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cat = await content.categoryBySlug(slug);
  if (!cat) notFound();
  const [posts, breadcrumb, cats, counts, banner] = await Promise.all([
    content.postsByCategory(cat.id),
    content.categoryBreadcrumb(cat.id),
    content.categories(),
    content.categoryCounts(),
    content.pickBanner(`/blog/category/${slug}`, "sidebar", () => 0),
  ]);
  const catItems = cats.filter((c) => !c.parentId).map((c) => ({ id: c.id, name: c.name, slug: c.slug, count: counts[c.id] ?? 0 }));
  return (
    <main className="mx-auto grid max-w-5xl grid-cols-1 gap-8 p-6 md:grid-cols-[1fr_16rem]">
      <div>
        <nav className="mb-2 text-xs text-neutral-500">
          <a href="/blog">ブログ</a>
          {breadcrumb.map((c) => <span key={c.id}> / <a href={`/blog/category/${c.slug}`}>{c.name}</a></span>)}
        </nav>
        <h1 className="mb-4 text-2xl font-bold">{cat.name}の記事</h1>
        {posts.length === 0 ? (
          <p className="text-sm text-neutral-500">記事がありません。</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {posts.map((p) => (
              <li key={p.slug} className="border-b border-neutral-100 pb-3">
                <a href={`/blog/${p.slug}`} className="font-semibold hover:text-blue-700">{p.title}</a>
                <p className="text-xs text-neutral-500">{p.publishedAt.slice(0, 10)}</p>
                {p.excerpt && <p className="mt-1 text-sm text-neutral-600">{p.excerpt}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
      <aside><SiteSidebar categories={catItems} banner={banner ? { id: banner.id, image: banner.image, href: banner.href, ...(banner.alt ? { alt: banner.alt } : {}), ...(banner.sponsored ? { sponsored: banner.sponsored } : {}) } : undefined} /></aside>
      <BeaconClient path={`/blog/category/${slug}`} />
    </main>
  );
}
