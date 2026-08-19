"use client";
/**
 * 掲示板スレッドのクライアント画面。投稿を /api/board/threads/[id]/posts に送り、PostCard で一覧表示する。
 * @packageDocumentation
 */
import * as React from "react";
import { PostCard, MessageComposer, Button, Textarea, ConfirmDialog } from "@platform/ui";

/** 表示用の投稿。 */
export interface ThreadPostView {
  id: string;
  authorName: string;
  body: string;
  timestamp?: string;
  edited?: boolean;
  /** 返信先の投稿 ID。スレッド本文なら未設定。 */
  replyTo?: string;
  /**
   * 投稿者の識別子(メール)。
   *
   * **表示名では判定しない。** 同姓同名がいれば他人の投稿を消せてしまう。
   */
  authorId: string;
}

/** props。 */
export interface BoardThreadClientProps {
  threadId: string;
  title: string;
  initialPosts: ThreadPostView[];
  /** ログイン中の利用者(自分の投稿だけ編集・削除できる)。 */
  meId?: string;
  /** 管理者は誰の投稿でも消せる。 */
  isAdmin?: boolean;
  fetchImpl?: typeof fetch;
}

/** 掲示板スレッド画面。 */
export function BoardThreadClient({ threadId, title, initialPosts, meId, isAdmin = false, fetchImpl }: BoardThreadClientProps) {
  const [posts, setPosts] = React.useState<ThreadPostView[]>(initialPosts);
  const [error, setError] = React.useState<string | null>(null);
  // どの投稿に返信しようとしているか(null なら返信中でない)
  const [replyTo, setReplyTo] = React.useState<string | null>(null);
  // どの投稿を編集中か
  const [editing, setEditing] = React.useState<string | null>(null);
  // 削除しようとしている投稿(null なら確認を出さない)
  const [removing, setRemoving] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;

  const submit = async (body: string, replyTo?: string) => {
    setError(null);
    const res = await doFetch(`/api/board/threads/${encodeURIComponent(threadId)}/posts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body, ...(replyTo !== undefined ? { replyTo } : {}) }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "投稿に失敗しました");
      return;
    }
    const post = (await res.json()) as { id: string; authorId: string; body: string; createdAt: string };
    setPosts((prev) => [...prev, {
      id: post.id, authorName: post.authorId, body: post.body,
      // **`authorId` を落とさない。** 消す・直すの可否は表示名ではなく
      // これで判定するので、抜けると**投稿直後だけ自分の投稿を編集できない**
      // (再読み込みすると直る、という分かりにくい症状になる)。
      authorId: post.authorId,
      timestamp: post.createdAt.slice(0, 16).replace("T", " "),
      ...(replyTo !== undefined ? { replyTo } : {}),
    }]);
    setReplyTo(null);
  };

  /**
   * 投稿を消す。
   *
   * **確認は `ConfirmDialog` で取る。**
   * `window.confirm` はブラウザの見た目に依存し、
   * **何が消えるのかを具体的に書けない**(対象の名前を出しにくい)。
   */
  const remove = async (id: string) => {
    const res = await doFetch(
      `/api/board/threads/${encodeURIComponent(threadId)}/posts/${encodeURIComponent(id)}`,
      { method: "DELETE" });
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      setError(d.error ?? "削除できませんでした");
      return;
    }
    setPosts((prev) => prev.filter((p) => p.id !== id && p.replyTo !== id));
  };

  /** 投稿を書き換える。 */
  const edit = async (id: string, body: string) => {
    const res = await doFetch(
      `/api/board/threads/${encodeURIComponent(threadId)}/posts/${encodeURIComponent(id)}`,
      { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ body }) });
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      setError(d.error ?? "編集できませんでした");
      return;
    }
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, body, edited: true } : p)));
    setEditing(null);
  };

  /**
   * 自分の投稿か(= 編集・削除してよいか)。
   *
   * **画面での判定は目印にすぎない。** サーバ側でも所有者を確かめている
   * (`boardPostStore.get` で引いた投稿で判定)。
   */
  const canModify = (authorId: string) => isAdmin || (meId !== undefined && authorId === meId);

  // **返信は 1 段だけ入れ子にする。**
  // 何段でも許すと、画面の右端に押しやられて読めなくなる。
  // 返信への返信も、同じ親の下に並べる(会話の流れは時刻で追える)
  const roots = posts.filter((p) => p.replyTo === undefined);
  const repliesOf = (id: string) => posts.filter((p) => p.replyTo === id);

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-lg font-semibold">{title}</h1>
      {roots.map((p) => {
        const replies = repliesOf(p.id);
        return (
          <div key={p.id}>
            {editing === p.id ? (
              <div className="rounded-[var(--radius)] border border-[var(--color-primary)] p-3">
                <Textarea
                  value={draft}
                  rows={4}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDraft(e.target.value)}
                />
                <div className="mt-2 flex gap-2">
                  <Button size="sm" onClick={() => void edit(p.id, draft)}>保存</Button>
                  <Button size="sm" variant="secondary" onClick={() => setEditing(null)}>やめる</Button>
                </div>
              </div>
            ) : (
              <>
                <PostCard
                  authorName={p.authorName} body={p.body} timestamp={p.timestamp} edited={p.edited}
                  replyCount={replies.length}
                  onReply={() => setReplyTo(replyTo === p.id ? null : p.id)}
                />
                {/* **自分の投稿にだけ出す。** 押せないボタンを並べても迷わせるだけ */}
                {canModify(p.authorId) && (
                  <div className="mt-1 flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => { setEditing(p.id); setDraft(p.body); }}>
                      編集
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setRemoving(p.id)}>削除</Button>
                  </div>
                )}
              </>
            )}
            {replies.length > 0 && (
              <div className="ml-6 mt-2 flex flex-col gap-2 border-l-2 border-[var(--color-border)] pl-3">
                {replies.map((r) => (
                  <div key={r.id}>
                    <PostCard authorName={r.authorName} body={r.body} timestamp={r.timestamp} edited={r.edited} />
                    {canModify(r.authorId) && (
                      <Button size="sm" variant="ghost" onClick={() => setRemoving(r.id)}>削除</Button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {replyTo === p.id && (
              <div className="ml-6 mt-2 border-l-2 border-[var(--color-primary)] pl-3">
                {/* **どれに返信するかを示す。** 入力欄だけ出すと、
                    スレッド全体への投稿と見分けが付かない */}
                <p className="mb-1 text-xs text-[var(--color-muted)]">
                  {p.authorName} さんへの返信
                </p>
                <MessageComposer onSend={(text: string) => void submit(text, p.id)} placeholder="返信を書く" />
              </div>
            )}
          </div>
        );
      })}
      {error && <p className="text-sm text-[var(--color-danger,#e11)]">{error}</p>}
      <MessageComposer onSend={(text: string) => void submit(text)} placeholder="スレッドに投稿する" />
      {/* **書き方を近くに置く。** 別ページの説明は読まれない */}
      <p className="mt-1 text-xs text-[var(--color-muted)]">
        <code>**太字**</code> / <code>*斜体*</code> / <code>`コード`</code> /{" "}
        <code>- 箇条書き</code> / <code>&gt; 引用</code> / <code>[表示](URL)</code> が使えます
      </p>
      {/* **何が消えるかを名指しで書く。**
          「削除しますか」では、どれを消すのか分からない */}
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => { if (!o) setRemoving(null); }}
        title="この投稿を削除します"
        description={posts.find((p) => p.id === removing)?.body.slice(0, 60) ?? ""}
        confirmText="削除する"
        destructive
        onConfirm={() => { if (removing !== null) void remove(removing); setRemoving(null); }}
      />
    </div>
  );
}
