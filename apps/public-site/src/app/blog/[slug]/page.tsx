import * as React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { shareLinks } from "@platform/social";
import { nl2br, linkify } from "@platform/html";
import { Eyecatch, SocialShare } from "@platform/ui";
import { content, siteConfig } from "../../../server/content";
import { BeaconClient } from "../../beacon-client";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await content.post(slug);
  if (!post) return {};
  return { title: post.title, description: post.excerpt, openGraph: { title: post.title, images: post.eyecatch ? [post.eyecatch] : [] } };
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await content.post(slug);
  if (!post) notFound();
  const [adj, related] = await Promise.all([content.adjacent(slug), content.related(slug, 3)]);
  const url = `${siteConfig.baseUrl}/blog/${post.slug}`;
  const links = shareLinks(["x", "facebook", "line", "hatena"], { url, title: post.title });
  const bodyHtml = nl2br(linkify(post.body));
  return (
    <main className="mx-auto max-w-3xl p-6">
      {post.eyecatch && <Eyecatch image={post.eyecatch} title={post.title} className="mb-6" />}
      <h1 className="mb-2 text-2xl font-bold">{post.title}</h1>
      <p className="mb-4 text-xs text-neutral-500">{post.publishedAt.slice(0, 10)}</p>
      <article className="leading-relaxed [&_a]:text-blue-600 [&_a]:underline" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
      {post.tags && post.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {post.tags.map((t) => <a key={t} href={`/blog/tag/${encodeURIComponent(t)}`} className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 hover:bg-neutral-200">#{t}</a>)}
        </div>
      )}
      <div className="mt-6 border-t border-neutral-100 pt-4">
        <p className="mb-2 text-sm font-medium">この記事をシェア</p>
        <SocialShare links={links} />
      </div>

      <nav className="mt-8 flex justify-between gap-4 border-t border-neutral-100 pt-4 text-sm">
        {adj.prev ? <a href={`/blog/${adj.prev.slug}`} className="text-blue-700 hover:underline">← {adj.prev.title}</a> : <span />}
        {adj.next ? <a href={`/blog/${adj.next.slug}`} className="text-right text-blue-700 hover:underline">{adj.next.title} →</a> : <span />}
      </nav>

      {related.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">関連記事</h2>
          <ul className="grid gap-4 sm:grid-cols-3">
            {related.map((r) => (
              <li key={r.slug} className="rounded border border-neutral-200 p-3">
                {r.eyecatch && <a href={`/blog/${r.slug}`}><img src={r.eyecatch} alt="" className="mb-2 h-24 w-full rounded object-cover" loading="lazy" /></a>}
                <a href={`/blog/${r.slug}`} className="text-sm font-medium hover:text-blue-700">{r.title}</a>
              </li>
            ))}
          </ul>
        </section>
      )}
      <BeaconClient path={`/blog/${slug}`} />
    </main>
  );
}
