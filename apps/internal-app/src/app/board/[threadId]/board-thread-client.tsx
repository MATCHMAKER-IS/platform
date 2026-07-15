"use client";
/**
 * 掲示板スレッドのクライアント画面。投稿を /api/board/threads/[id]/posts に送り、PostCard で一覧表示する。
 * @packageDocumentation
 */
import * as React from "react";
import { PostCard, MessageComposer } from "@platform/ui";

/** 表示用の投稿。 */
export interface ThreadPostView {
  id: string;
  authorName: string;
  body: string;
  timestamp?: string;
  edited?: boolean;
}

/** props。 */
export interface BoardThreadClientProps {
  threadId: string;
  title: string;
  initialPosts: ThreadPostView[];
  fetchImpl?: typeof fetch;
}

/** 掲示板スレッド画面。 */
export function BoardThreadClient({ threadId, title, initialPosts, fetchImpl }: BoardThreadClientProps) {
  const [posts, setPosts] = React.useState<ThreadPostView[]>(initialPosts);
  const [error, setError] = React.useState<string | null>(null);
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;

  const submit = async (body: string) => {
    setError(null);
    const res = await doFetch(`/api/board/threads/${encodeURIComponent(threadId)}/posts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "投稿に失敗しました");
      return;
    }
    const post = (await res.json()) as { id: string; authorId: string; body: string; createdAt: string };
    setPosts((prev) => [...prev, { id: post.id, authorName: post.authorId, body: post.body, timestamp: post.createdAt.slice(0, 16).replace("T", " ") }]);
  };

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-lg font-semibold">{title}</h1>
      {posts.map((p) => (
        <PostCard key={p.id} authorName={p.authorName} body={p.body} timestamp={p.timestamp} edited={p.edited} />
      ))}
      {error && <p className="text-sm text-[var(--color-danger,#e11)]">{error}</p>}
      <MessageComposer onSend={(text: string) => void submit(text)} placeholder="返信を書く" />
    </div>
  );
}
