import { formatDateJst } from "@platform/datetime";
import * as React from "react";
import type { Metadata } from "next";
import { content } from "../../../../server/content";
import { BeaconClient } from "../../../beacon-client";

export async function generateMetadata({ params }: { params: Promise<{ tag: string }> }): Promise<Metadata> {
  const { tag } = await params;
  return { title: `#${decodeURIComponent(tag)} の記事` };
}

export default async function TagPage({ params }: { params: Promise<{ tag: string }> }) {
  const { tag } = await params;
  const decoded = decodeURIComponent(tag);
  const posts = await content.postsByTag(decoded);
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-2xl font-bold">#{decoded} の記事</h1>
      {posts.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">記事がありません。</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {posts.map((p) => (
            <li key={p.slug} className="border-b border-[var(--color-border)] pb-3">
              <a href={`/blog/${p.slug}`} className="font-semibold hover:text-[var(--color-primary)]">{p.title}</a>
              <p className="text-xs text-[var(--color-muted)]">{formatDateJst(new Date(p.publishedAt))}</p>
              {p.excerpt && <p className="mt-1 text-sm text-[var(--color-muted)]">{p.excerpt}</p>}
            </li>
          ))}
        </ul>
      )}
      <BeaconClient path={`/blog/tag/${tag}`} />
    </main>
  );
}
