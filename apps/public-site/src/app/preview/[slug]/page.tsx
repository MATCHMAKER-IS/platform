import * as React from "react";
import type { Metadata } from "next";
import { formatDateJst } from "@platform/datetime";
import { Eyecatch, Markdown } from "@platform/ui";
import { getPreviewPost, isValidPreviewToken } from "../../../server/preview";
import { cmsPostsForPreview } from "../../../server/content";

export const metadata: Metadata = { title: "プレビュー", robots: { index: false } };

const STATUS_LABEL: Record<string, string> = { draft: "下書き", scheduled: "予約公開", published: "公開中" };

export default async function PreviewPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ token?: string }> }) {
  const { slug } = await params;
  const { token } = await searchParams;

  if (!isValidPreviewToken(token)) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="text-xl font-bold">プレビューを表示できません</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">有効なプレビュートークンが必要です。</p>
      </main>
    );
  }

  const result = getPreviewPost(cmsPostsForPreview, slug);
  if (!result) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="text-xl font-bold">記事が見つかりません</h1>
      </main>
    );
  }

  const { post, status } = result;
  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-4 rounded border border-[color-mix(in_srgb,var(--color-warning)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-warning)_8%,transparent)] px-4 py-2 text-sm text-[var(--color-warning)]">
        プレビュー表示（{STATUS_LABEL[status] ?? status}）— この画面は公開されていません。
      </div>
      {post.eyecatch && <Eyecatch image={post.eyecatch} title={post.title} className="mb-6" />}
      <h1 className="mb-2 text-2xl font-bold">{post.title}</h1>
      <p className="mb-4 text-xs text-[var(--color-muted)]">{formatDateJst(new Date(post.publishedAt))}</p>
      {/* **Markdown として描く。**
          以前は `nl2br(linkify(...))` を `dangerouslySetInnerHTML` で流していた。
          本文は CMS の編集者が書いたもので、サニタイズを通していなかった。
          `Markdown` は React 要素に組み立てるので、その経路が無い */}
      <article className="leading-relaxed">
        <Markdown>{post.body}</Markdown>
      </article>
      {post.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {post.tags.map((t) => <span key={t} className="rounded bg-[var(--color-subtle)] px-2 py-0.5 text-xs text-[var(--color-muted)]">#{t}</span>)}
        </div>
      )}
    </main>
  );
}
