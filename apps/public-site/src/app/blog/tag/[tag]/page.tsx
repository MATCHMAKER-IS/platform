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
      <BeaconClient path={`/blog/tag/${tag}`} />
    </main>
  );
}
