import * as React from "react";
import type { Metadata } from "next";
import { nl2br, linkify } from "@platform/html";
import { Eyecatch } from "@platform/ui";
import { getPreviewPost, isValidPreviewToken } from "../../../server/preview.js";
import { cmsPostsForPreview } from "../../../server/content.js";

export const metadata: Metadata = { title: "プレビュー", robots: { index: false } };

const STATUS_LABEL: Record<string, string> = { draft: "下書き", scheduled: "予約公開", published: "公開中" };

export default async function PreviewPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ token?: string }> }) {
  const { slug } = await params;
  const { token } = await searchParams;

  if (!isValidPreviewToken(token)) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="text-xl font-bold">プレビューを表示できません</h1>
        <p className="mt-2 text-sm text-neutral-600">有効なプレビュートークンが必要です。</p>
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
  const bodyHtml = nl2br(linkify(post.body));
  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-4 rounded border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800">
        プレビュー表示（{STATUS_LABEL[status] ?? status}）— この画面は公開されていません。
      </div>
      {post.eyecatch && <Eyecatch image={post.eyecatch} title={post.title} className="mb-6" />}
      <h1 className="mb-2 text-2xl font-bold">{post.title}</h1>
      <p className="mb-4 text-xs text-neutral-500">{post.publishedAt.slice(0, 10)}</p>
      <article className="leading-relaxed [&_a]:text-blue-600 [&_a]:underline" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
      {post.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {post.tags.map((t) => <span key={t} className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">#{t}</span>)}
        </div>
      )}
    </main>
  );
}
