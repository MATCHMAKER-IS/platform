"use client";
/** 掲示板のデモ: スレッド・返信・タグ・検索・ピン留め・並び替え。 */
import * as React from "react";
import { Button, Input, Textarea } from "@platform/ui";
import {
  createThread,
  createPost,
  canReply,
  rootPosts,
  repliesOf,
  canModifyPost,
  extractMentions,
  summarize,
  sortThreads,
  filterByTag,
  searchThreads,
  toggleReaction,
  countReactions,
  userReactions,
  MAX_POST_LENGTH,
  MAX_TITLE_LENGTH,
  type Post,
  type Thread,
  type Reaction,
} from "@platform/board";

const ME = { id: "u-taro", handle: "taro", name: "山田太郎" };

const PEOPLE: Record<string, string> = { "u-taro": "山田太郎", "u-hanako": "鈴木花子", "u-admin": "管理者" };

const SEED_THREADS: Thread[] = [
  { id: "t1", title: "【周知】新しい経費精算システムの運用開始について", authorId: "u-admin", createdAt: "2026-07-10T09:00:00Z", tags: ["お知らせ"], pinned: true },
  { id: "t2", title: "VPN が繋がらないときの確認手順", authorId: "u-taro", createdAt: "2026-07-14T10:00:00Z", tags: ["ヘルプ", "ネットワーク"] },
  { id: "t3", title: "社内基盤のデモサイトを公開しました", authorId: "u-taro", createdAt: "2026-07-16T15:00:00Z", tags: ["お知らせ", "基盤"] },
  { id: "t4", title: "この投稿は返信できません（施錠済み）", authorId: "u-admin", createdAt: "2026-07-01T09:00:00Z", tags: ["アーカイブ"], locked: true },
];

const SEED_POSTS: Record<string, Post[]> = {
  t1: [
    { id: "p1", authorId: "u-admin", body: "8 月 1 日から新システムに切り替えます。旧システムは 7/31 で締め切ります。", createdAt: "2026-07-10T09:00:00Z" },
    { id: "p2", authorId: "u-hanako", body: "7 月分の精算は旧システムでよいでしょうか？", createdAt: "2026-07-10T11:20:00Z", replyTo: "p1" },
    { id: "p3", authorId: "u-admin", body: "はい、7 月分は旧システムでお願いします。", createdAt: "2026-07-10T13:00:00Z", replyTo: "p2" },
  ],
  t2: [
    { id: "p4", authorId: "u-taro", body: "まず社内 Wi-Fi かどうかを確認してください。社内からは VPN 不要です。", createdAt: "2026-07-14T10:00:00Z" },
    { id: "p5", authorId: "u-hanako", body: "@taro 自宅から繋がらないのですが、証明書の期限でしょうか", createdAt: "2026-07-15T08:30:00Z" },
  ],
  t3: [{ id: "p6", authorId: "u-taro", body: "60 以上のデモを置いています。基盤で何ができるか見てください。", createdAt: "2026-07-16T15:00:00Z" }],
  t4: [{ id: "p7", authorId: "u-admin", body: "過去ログです。", createdAt: "2026-07-01T09:00:00Z" }],
};

const box: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  background: "var(--color-surface)",
  padding: 16,
  marginBottom: 16,
};

const field: React.CSSProperties = {
  height: 36,
  padding: "0 12px",
  borderRadius: "var(--radius)",
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-fg)",
  fontSize: 13,
};

const REACTIONS = ["like", "check"];
const REACTION_EMOJI: Record<string, string> = { like: "👍", check: "✅" };

const day = (iso: string) => iso.slice(0, 10);

export function BoardThreadsDemo() {
  const [threads, setThreads] = React.useState<Thread[]>(SEED_THREADS);
  const [postsByThread, setPostsByThread] = React.useState<Record<string, Post[]>>(SEED_POSTS);
  const [openId, setOpenId] = React.useState<string | null>("t1");
  const [keyword, setKeyword] = React.useState("");
  const [tag, setTag] = React.useState("");
  const [body, setBody] = React.useState("");
  const [replyTo, setReplyTo] = React.useState<Post | null>(null);
  const [error, setError] = React.useState("");
  const [newTitle, setNewTitle] = React.useState("");
  const [reactions, setReactions] = React.useState<Reaction[]>([]);

  const summaries = React.useMemo(
    () => threads.map((t) => summarize(t, postsByThread[t.id] ?? [])),
    [threads, postsByThread],
  );

  const visible = React.useMemo(() => {
    let list = sortThreads(summaries);
    if (tag !== "") list = filterByTag(list, tag);
    if (keyword.trim() !== "") list = searchThreads(list, postsByThread, keyword.trim());
    return list;
  }, [summaries, tag, keyword, postsByThread]);

  const allTags = React.useMemo(() => [...new Set(threads.flatMap((t) => t.tags ?? []))], [threads]);

  const open = openId !== null ? threads.find((t) => t.id === openId) ?? null : null;
  const openPosts = openId !== null ? postsByThread[openId] ?? [] : [];
  const roots = rootPosts(openPosts);

  function addThread() {
    setError("");
    const r = createThread({ id: `t${Date.now()}`, title: newTitle, authorId: ME.id, tags: ["質問"] });
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setThreads((prev) => [...prev, r.thread]);
    setPostsByThread((prev) => ({ ...prev, [r.thread.id]: [] }));
    setNewTitle("");
    setOpenId(r.thread.id);
  }

  function addPost() {
    if (open === null) return;
    setError("");
    const r = createPost({
      id: `p${Date.now()}`,
      authorId: ME.id,
      body,
      ...(replyTo ? { replyTo: replyTo.id } : {}),
    });
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setPostsByThread((prev) => ({ ...prev, [open.id]: [...(prev[open.id] ?? []), r.post] }));
    setBody("");
    setReplyTo(null);
  }

  function react(postId: string, kind: string) {
    setReactions((prev) => toggleReaction(prev, { postId, userId: ME.id, kind }));
  }

  const replyOk = open !== null && canReply(open);

  function renderPost(p: Post, depth = 0) {
    const children = repliesOf(openPosts, p.id);
    const counts = countReactions(reactions, p.id);
    const mine = userReactions(reactions, p.id, ME.id);
    return (
      <div key={p.id} style={{ marginLeft: depth * 20, borderLeft: depth > 0 ? "2px solid var(--color-border)" : "none", paddingLeft: depth > 0 ? 12 : 0 }}>
        <div style={{ padding: "10px 0", borderTop: depth === 0 ? "1px solid var(--color-border)" : "none" }}>
          <div style={{ fontSize: 11, color: "var(--color-muted)", marginBottom: 4 }}>
            {PEOPLE[p.authorId]} · {day(p.createdAt)}
            {canModifyPost(p, ME.id) && <span style={{ marginLeft: 8 }}>編集可</span>}
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.8 }}>{p.body}</div>
          <div style={{ display: "flex", gap: 4, marginTop: 6, alignItems: "center" }}>
            {REACTIONS.map((k) => {
              const n = counts[k] ?? 0;
              const on = mine.includes(k);
              return (
                <Button
                  key={k}
                  onClick={() => react(p.id, k)}
                  style={{ fontSize: 11, padding: "1px 6px", borderRadius: 999, border: "1px solid", borderColor: on ? "var(--color-primary)" : "var(--color-border)", background: "var(--color-bg)", color: "var(--color-fg)", cursor: "pointer" }}
                >
                  {REACTION_EMOJI[k]}
                  {n > 0 && <span style={{ marginLeft: 3 }}>{n}</span>}
                </Button>
              );
            })}
            {replyOk && (
              <Button onClick={() => setReplyTo(p)} style={{ fontSize: 10, padding: "1px 6px", border: "none", background: "transparent", color: "var(--color-muted)", cursor: "pointer" }}>
                返信
              </Button>
            )}
          </div>
        </div>
        {children.map((c) => renderPost(c, depth + 1))}
      </div>
    );
  }

  return (
    <>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 4 }}>掲示板</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.8, marginBottom: 20 }}>
        <code>@platform/board</code> も<strong>純ロジック</strong>です。スレッドの並び替え・タグ・検索・
        入れ子の返信を持ちます。<strong>ピン留めしたスレッドが必ず先頭に来る</strong>、
        <strong>クローズ済みには返信できない</strong>といった判断がロジック側にあります。
      </p>

      <div style={box}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="タイトル・本文を検索" style={{ ...field, flex: 1, minWidth: 180 }} />
          <select value={tag} onChange={(e) => setTag(e.target.value)} style={{ ...field, width: 140 }}>
            <option value="">タグ: すべて</option>
            {allTags.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <span style={{ fontSize: 12, color: "var(--color-muted)" }}>{visible.length} / {threads.length} 件</span>
        </div>
        <p style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 8 }}>
          <code>searchThreads()</code> は<strong>タイトルだけでなく本文も見ます</strong>。
          「証明書」で検索すると、タイトルに無い t2 が出ます。
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
        {/* スレッド一覧 */}
        <div style={{ ...box, padding: 8 }}>
          {visible.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--color-muted)", padding: 12 }}>該当なし</p>
          ) : (
            visible.map((s) => (
              <Button
                key={s.thread.id}
                onClick={() => {
                  setOpenId(s.thread.id);
                  setReplyTo(null);
                }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 12px",
                  borderRadius: "var(--radius)",
                  border: "none",
                  background: openId === s.thread.id ? "color-mix(in srgb, var(--color-primary) 12%, transparent)" : "transparent",
                  cursor: "pointer",
                  marginBottom: 2,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.5 }}>
                  {s.thread.pinned === true && <span title="固定" style={{ marginRight: 4 }}>📌</span>}
                  {s.thread.locked === true && <span title="施錠済み(返信不可)" style={{ marginRight: 4 }}>🔒</span>}
                  {s.thread.title}
                </div>
                <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 3 }}>
                  {PEOPLE[s.thread.authorId]} · 返信 {s.replyCount} · {s.participants}人 · 最終 {day(s.lastActivityAt)}
                </div>
                <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                  {(s.thread.tags ?? []).map((t) => (
                    <span key={t} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 999, background: "var(--color-bg)", border: "1px solid var(--color-border)", color: "var(--color-muted)" }}>
                      {t}
                    </span>
                  ))}
                </div>
              </Button>
            ))
          )}

          <div style={{ borderTop: "1px solid var(--color-border)", marginTop: 8, paddingTop: 10, display: "flex", gap: 6 }}>
            <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="新しいスレッドのタイトル" style={{ ...field, flex: 1, fontSize: 12 }} />
            <Button onClick={addThread} style={{ height: 36, padding: "0 14px", borderRadius: "var(--radius)", border: "none", background: "var(--color-primary)", color: "var(--color-primary-fg)", cursor: "pointer", fontSize: 12 }}>
              立てる
            </Button>
          </div>
          <div style={{ fontSize: 10, color: "var(--color-muted)", marginTop: 4, textAlign: "right" }}>
            {newTitle.length} / {MAX_TITLE_LENGTH}
          </div>
        </div>

        {/* スレッド詳細 */}
        <div style={box}>
          {open === null ? (
            <p style={{ fontSize: 13, color: "var(--color-muted)" }}>スレッドを選んでください</p>
          ) : (
            <>
              <h2 style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.6, marginBottom: 4 }}>{open.title}</h2>
              <div style={{ fontSize: 11, color: "var(--color-muted)", marginBottom: 10 }}>
                {PEOPLE[open.authorId]} · {day(open.createdAt)}
              </div>

              <div style={{ maxHeight: 340, overflowY: "auto" }}>{roots.map((p) => renderPost(p))}</div>

              <div style={{ borderTop: "1px solid var(--color-border)", marginTop: 12, paddingTop: 12 }}>
                {!replyOk ? (
                  <div style={{ fontSize: 12, color: "var(--color-muted)", textAlign: "center", padding: 10 }}>
                    🔒 このスレッドは施錠されています（<code>canReply()</code> が false）
                  </div>
                ) : (
                  <>
                    {replyTo && (
                      <div style={{ fontSize: 11, color: "var(--color-muted)", marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
                        <span>返信先: {PEOPLE[replyTo.authorId]}「{replyTo.body.slice(0, 20)}」</span>
                        <Button aria-label="返信をやめる" title="返信をやめる" onClick={() => setReplyTo(null)} style={{ border: "none", background: "transparent", color: "var(--color-muted)", cursor: "pointer" }}>×</Button>
                      </div>
                    )}
                    <Textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      rows={3}
                      placeholder="本文（@taro でメンション）"
                      style={{ width: "100%", padding: 10, borderRadius: "var(--radius)", border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-fg)", fontSize: 13, fontFamily: "inherit" }}
                    />
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                      <span style={{ fontSize: 11, color: error !== "" ? "var(--color-danger)" : "var(--color-muted)" }}>
                        {error !== "" ? error : extractMentions(body).map((h) => `@${h}`).join(" ")}
                      </span>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ fontSize: 10, color: body.length > MAX_POST_LENGTH ? "var(--color-danger)" : "var(--color-muted)" }}>
                          {body.length} / {MAX_POST_LENGTH}
                        </span>
                        <Button onClick={addPost} style={{ height: 32, padding: "0 16px", borderRadius: "var(--radius)", border: "none", background: "var(--color-primary)", color: "var(--color-primary-fg)", cursor: "pointer", fontSize: 12 }}>
                          投稿
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ ...box, marginTop: 16 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>試してみてください</h2>
        <ul style={{ fontSize: 13, lineHeight: 2, margin: 0, paddingLeft: "1.2em", color: "var(--color-muted)" }}>
          <li>
            <strong>「証明書」で検索</strong> → タイトルに無い t2 が出ます（<code>searchThreads()</code> は本文も見る）
          </li>
          <li>
            <strong>📌 のスレッドは必ず先頭</strong> — <code>sortThreads()</code> が
            「固定 → 最終投稿の新しい順」で並べます。最新の t3 より上に来ます
          </li>
          <li>
            <strong>🔒 のスレッドは返信欄が出ません</strong> — <code>locked: true</code> で <code>canReply()</code> が false。
            <strong>UI で隠すだけでなくロジックが拒否する</strong>ので、API を直接叩かれても閉じたままです
          </li>
          <li>タイトルを空で「立てる」→ <code>createThread()</code> が「タイトルが空です」で弾きます</li>
          <li>返信は<strong>入れ子</strong>で表示されます（<code>rootPosts()</code> と <code>repliesOf()</code>）</li>
        </ul>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 12, lineHeight: 1.8 }}>
          コードで見たい場合は
          <a href="/examples/board-threads" style={{ color: "var(--color-primary)", margin: "0 4px" }}>掲示板ロジック（使用例）</a>
          と
          <a href="/examples/chat-room" style={{ color: "var(--color-primary)", margin: "0 4px" }}>チャットロジック（使用例）</a>
          があります。
        </p>
      </div>
    </>
  );
}
