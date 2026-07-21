"use client";
/**
 * 公開サイトのデモ(モックデータ)。ブログ + 公式サイト。
 *
 * **実物は `apps/public-site`**(10 画面)。
 * UI は **@platform/ui の部品だけ**で組む(CLAUDE.md「UI 部品は @platform/ui を使う」)。
 */
import * as React from "react";
import { Button, Input, Badge, Alert, Separator, DatePicker } from "@platform/ui";
import {
  publishedPosts,
  postsByCategory,
  tagCounts,
  relatedPosts,
  readingTime,
  excerpt,
  extractHeadings,
  slugify,
  ensureSlug,
  adjacentPosts,
  buildPermalink,
  postUrl,
  buildRssFeed,
  buildSitemap,
  buildCommentTree,
  approvedComments,
  countComments,
  pendingCount,
  type BlogPost,
  type Comment,
  type FeedItem,
} from "@platform/blog";
import { buildMeta, renderMetaTags } from "@platform/seo";

const banner: React.CSSProperties = {
  padding: "10px 16px",
  fontSize: 12,
  lineHeight: 1.7,
  background: "var(--color-surface)",
  borderBottom: "1px solid var(--color-border)",
  color: "var(--color-muted)",
};

const box: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  background: "var(--color-surface)",
  padding: 16,
  marginBottom: 16,
};

const mono: React.CSSProperties = { fontFamily: "monospace", fontSize: 11, wordBreak: "break-all" };

const code: React.CSSProperties = {
  ...mono,
  display: "block",
  background: "var(--color-bg)",
  border: "1px solid var(--color-border)",
  borderRadius: 4,
  padding: "8px 10px",
  lineHeight: 1.7,
  whiteSpace: "pre-wrap",
  maxHeight: 180,
  overflow: "auto",
};

const BASE_URL = "https://example.co.jp";
const PATTERN = "/blog/:year/:month/:slug";

const meta = { author: "広報", createdAt: "2026-06-01T00:00:00Z", updatedAt: "2026-06-01T00:00:00Z" };

/**
 * `BlogPost` は index signature(`[key: string]: unknown`)を持つので、
 * `body` や `excerpt` を直接読むと `unknown` になる。使うフィールドを明示する。
 */
type DemoPost = BlogPost & { body: string; summary: string };

const POSTS: DemoPost[] = [
  {
    id: "p1",
    slug: "release-v2",
    title: "新バージョンをリリースしました",
    body: "# 新機能\n\n経費精算がスマホから使えるようになりました。領収書を撮るだけで、科目を自動で推定します。\n\n## 使い方\n\nアプリを開いて「経費」→「撮影」を選んでください。\n\n## 注意点\n\n手書きの領収書は精度が落ちます。金額だけ確認してください。",
    summary: "経費精算がスマホから使えるようになりました",
    category: "お知らせ",
    tags: ["リリース", "経費"],
    status: "published",
    publishedAt: "2026-07-10T00:00:00Z",
    ...meta,
  },
  {
    id: "p2",
    slug: "security-update",
    title: "セキュリティ強化のお知らせ",
    body: "# 二要素認証の必須化\n\n7 月末までに設定をお願いします。\n\n## 設定方法\n\n認証アプリで QR を読み取ってください。",
    summary: "二要素認証を必須にします",
    category: "お知らせ",
    tags: ["セキュリティ"],
    status: "published",
    publishedAt: "2026-07-05T00:00:00Z",
    ...meta,
  },
  {
    id: "p3",
    slug: "interview-01",
    title: "現場の声: 情シスの一日",
    body: "# 朝の仕事\n\n出社してまず見るのは「今日やること」の画面です。契約の更新期限、期限切れのタスク、直すべき FAQ が並んでいます。",
    summary: "朝、出社してまず見るのは「今日やること」の画面です",
    category: "コラム",
    tags: ["インタビュー"],
    status: "published",
    publishedAt: "2026-06-28T00:00:00Z",
    ...meta,
  },
  {
    id: "p4",
    slug: "roadmap-2027",
    title: "【予約公開】2027 年のロードマップ",
    body: "# 来年の計画\n\n未公開です。",
    summary: "2027 年の計画",
    category: "お知らせ",
    tags: ["リリース"],
    status: "scheduled",
    publishedAt: "2026-07-20T00:00:00Z",
    ...meta,
  },
  {
    id: "p5",
    slug: "draft-post",
    title: "（下書き）次期機能の検討",
    body: "検討中",
    summary: "",
    category: "お知らせ",
    tags: [],
    status: "draft",
    ...meta,
  },
];

const COMMENTS: Comment[] = [
  { id: "c1", postId: "p1", author: "山田", body: "スマホで撮るだけとは助かります", status: "approved", createdAt: "2026-07-11T09:00:00Z" },
  { id: "c2", postId: "p1", author: "広報", body: "ありがとうございます。ご不明点があればお問い合わせください。", status: "approved", createdAt: "2026-07-11T14:00:00Z", parentId: "c1" },
  { id: "c3", postId: "p1", author: "鈴木", body: "手書きの領収書は対応しますか？", status: "approved", createdAt: "2026-07-12T10:00:00Z" },
  { id: "c4", postId: "p1", author: "spam-bot", body: "格安で SEO 対策します https://spam.example", status: "spam", createdAt: "2026-07-12T23:00:00Z" },
  { id: "c5", postId: "p1", author: "佐藤", body: "承認待ちのコメントです", status: "pending", createdAt: "2026-07-13T08:00:00Z" },
];

export function SiteDemo() {
  const [now, setNow] = React.useState("2026-07-15");
  const [category, setCategory] = React.useState<string | null>(null);
  const [tag, setTag] = React.useState<string | null>(null);
  const [openId, setOpenId] = React.useState<string | null>("p1");
  const [newTitle, setNewTitle] = React.useState("新しい記事のタイトル");

  const nowDate = React.useMemo(() => {
    const d = new Date(`${now}T00:00:00Z`);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }, [now]);

  const live = publishedPosts(POSTS, nowDate);
  const tags = tagCounts(POSTS);
  const categories = [...new Set(POSTS.map((p) => p.category).filter((c): c is string => c !== undefined))];

  let shown = live;
  if (category !== null) shown = postsByCategory(shown, category);
  if (tag !== null) shown = shown.filter((p) => (p.tags ?? []).includes(tag));

  const open = openId !== null ? POSTS.find((p) => p.id === openId) ?? null : null;
  const toc = open !== null ? extractHeadings(open.body, { allowUnicode: true }) : [];
  const adj = open !== null ? adjacentPosts(live, open.id, nowDate) : { newer: null, older: null };
  const related = open !== null ? relatedPosts(open, live, 2) : [];
  const tree = buildCommentTree(approvedComments(COMMENTS.filter((c) => c.postId === openId)));

  const rss = buildRssFeed(
    { title: "サンプル公式ブログ", link: BASE_URL, description: "製品と現場のこと", language: "ja" },
    live.map<FeedItem>((p) => ({
      title: p.title,
      link: postUrl(p, { pattern: PATTERN, baseUrl: BASE_URL }),
      description: p.summary,
      publishedAt: p.publishedAt,
      guid: p.id,
    })),
  );
  const sitemap = buildSitemap([
    { loc: `${BASE_URL}/`, lastmod: "2026-07-15" },
    ...live.map((p) => ({ loc: postUrl(p, { pattern: PATTERN, baseUrl: BASE_URL }), lastmod: p.publishedAt?.slice(0, 10) })),
  ]);
  const seoMeta = open !== null
    ? buildMeta({
        title: open.title,
        titleTemplate: "%s | サンプル公式",
        description: open.summary,
        canonical: postUrl(open, { pattern: PATTERN, baseUrl: BASE_URL }),
        visibility: "public",
      })
    : null;

  return (
    <div>
      <div style={banner}>
        これは <strong>デモ</strong> です。実物は <code>apps/public-site</code>（10 画面）。ここは<strong>モックデータ</strong>です。
      </div>

      <main style={{ maxWidth: 900, margin: "1.5rem auto", padding: "0 1rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 4 }}>公開サイト（ブログ + 公式）</h1>
        <p style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.8, marginBottom: 16 }}>
          自社サイトのブログと会社案内。<code>@platform/blog</code> は<strong>純ロジック</strong>で、
          公開判定・目次・関連記事・RSS・コメントを持ちます（画面はアプリ側）。
        </p>

        <div style={box}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--color-muted)" }}>
              今日
              <DatePicker value={now} onChange={(e) => setNow(e.target.value)} style={{ width: 150 }} />
            </label>
            <span style={{ fontSize: 12, color: "var(--color-muted)" }}>
              全 {POSTS.length} 件中、公開中は <b style={{ color: "var(--color-fg)" }}>{live.length}</b> 件
            </span>
          </div>
          <Alert variant="info" title="「今日」を 2026-07-25 にしてください" style={{ marginTop: 10 }}>
            <span style={{ fontSize: 12, lineHeight: 1.8 }}>
              <strong>予約公開の記事が自動で出ます。</strong>
              <code>status: &quot;scheduled&quot;</code> は <code>publishedAt</code> を過ぎると公開扱いになります——
              <strong>公開日に手作業で切り替える必要がありません</strong>。
              <br />
              下書き（<code>draft</code>）は<strong>いつまでも出ません</strong>。
            </span>
          </Alert>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 16, alignItems: "start" }}>
          {/* 一覧 */}
          <div style={box}>
            <div style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 6 }}>カテゴリ</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
              <Button size="sm" variant={category === null ? "primary" : "secondary"} onClick={() => setCategory(null)}>
                すべて
              </Button>
              {categories.map((c) => (
                <Button key={c} size="sm" variant={category === c ? "primary" : "secondary"} onClick={() => setCategory(c)}>
                  {c}
                </Button>
              ))}
            </div>

            <div style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 6 }}>タグ</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 12 }}>
              <Button size="sm" variant={tag === null ? "primary" : "secondary"} onClick={() => setTag(null)}>
                すべて
              </Button>
              {tags.map((t) => (
                <Button key={t.tag} size="sm" variant={tag === t.tag ? "primary" : "secondary"} onClick={() => setTag(t.tag)}>
                  {t.tag} {t.count}
                </Button>
              ))}
            </div>

            <Separator style={{ margin: "10px 0" }} />

            {shown.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--color-muted)" }}>該当なし</p>
            ) : (
              shown.map((p) => (
                <Button
                  key={p.id}
                  variant="ghost"
                  onClick={() => setOpenId(p.id)}
                  style={{
                    display: "block",
                    width: "100%",
                    height: "auto",
                    textAlign: "left",
                    padding: "10px 8px",
                    background: openId === p.id ? "color-mix(in srgb, var(--color-primary) 10%, transparent)" : "transparent",
                    marginBottom: 2,
                  }}
                >
                  <span style={{ display: "block", fontSize: 11, color: "var(--color-muted)", marginBottom: 3 }}>
                    {p.publishedAt?.slice(0, 10)} ・ {p.category} ・ 約 {readingTime(p.body).minutes} 分
                  </span>
                  <span style={{ display: "block", fontSize: 14, fontWeight: 600, lineHeight: 1.5 }}>{p.title}</span>
                  <span style={{ display: "block", fontSize: 12, color: "var(--color-muted)", marginTop: 3, lineHeight: 1.6, whiteSpace: "normal" }}>
                    {excerpt(p.body, { maxLength: 44 })}
                  </span>
                </Button>
              ))
            )}

            <p style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.7 }}>
              <strong>読了時間は文字種で判定します</strong>——日本語 400 字は <b>1 分</b>、英語 400 語は <b>2 分</b>。
              <strong>読む速さが違う</strong>ので、単語数で数えると日本語の記事が過大評価されます。
              <br />
              抜粋は <code>excerpt()</code> が Markdown を落としてから切ります（<code>#</code> や <code>**</code> が残らない）。
            </p>
          </div>

          {/* 記事 */}
          <div style={box}>
            {open === null ? (
              <p style={{ fontSize: 13, color: "var(--color-muted)" }}>記事を選んでください</p>
            ) : (
              <>
                <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
                  <Badge variant={open.status === "published" ? "success" : open.status === "scheduled" ? "warning" : "secondary"}>
                    {open.status === "published" ? "公開中" : open.status === "scheduled" ? "予約公開" : "下書き"}
                  </Badge>
                  <span style={{ fontSize: 11, color: "var(--color-muted)" }}>
                    {open.publishedAt?.slice(0, 10) ?? "未設定"} ・ 約 {readingTime(open.body).minutes} 分
                  </span>
                </div>
                <h2 style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.5, marginBottom: 8 }}>{open.title}</h2>

                <div style={{ fontSize: 11, color: "var(--color-muted)", marginBottom: 4 }}>URL（{PATTERN}）</div>
                <span style={{ ...mono, display: "block", background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 4, padding: "5px 8px", marginBottom: 10 }}>
                  {postUrl(open, { pattern: PATTERN, baseUrl: BASE_URL })}
                </span>

                {toc.length > 0 && (
                  <div style={{ background: "var(--color-bg)", borderRadius: "var(--radius)", padding: "8px 12px", marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: "var(--color-muted)", marginBottom: 4 }}>目次</div>
                    {toc.map((t) => (
                      <div key={t.slug} style={{ fontSize: 12, paddingLeft: (t.level - 1) * 12, lineHeight: 1.8 }}>
                        {t.text}
                        <span style={{ ...mono, color: "var(--color-muted)", marginLeft: 6 }}>#{t.slug}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ fontSize: 13, lineHeight: 1.9, whiteSpace: "pre-wrap", marginBottom: 12 }}>{open.body}</div>

                <Separator style={{ margin: "12px 0" }} />

                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, marginBottom: 10 }}>
                  <span style={{ color: "var(--color-muted)" }}>
                    {adj.older !== null ? `← ${adj.older.title.slice(0, 14)}` : "← （なし）"}
                  </span>
                  <span style={{ color: "var(--color-muted)" }}>
                    {adj.newer !== null ? `${adj.newer.title.slice(0, 14)} →` : "（なし）→"}
                  </span>
                </div>

                {related.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: "var(--color-muted)", marginBottom: 4 }}>関連記事（タグの一致で選ぶ）</div>
                    {related.map((r) => (
                      <div key={r.id} style={{ fontSize: 12, lineHeight: 1.8 }}>
                        ・{r.title}
                      </div>
                    ))}
                  </div>
                )}

                <Separator style={{ margin: "12px 0" }} />

                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>コメント {countComments(tree)} 件</span>
                  {pendingCount(COMMENTS) > 0 && <Badge variant="warning">承認待ち {pendingCount(COMMENTS)}</Badge>}
                </div>
                {tree.map((c) => (
                  <div key={c.id} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 12 }}>
                      <b>{c.author}</b>
                      <span style={{ color: "var(--color-muted)", marginLeft: 6, fontSize: 11 }}>{c.createdAt.slice(0, 10)}</span>
                    </div>
                    <div style={{ fontSize: 12.5, lineHeight: 1.7 }}>{c.body}</div>
                    {(c.replies ?? []).map((r) => (
                      <div key={r.id} style={{ marginLeft: 16, marginTop: 6, paddingLeft: 8, borderLeft: "2px solid var(--color-border)" }}>
                        <div style={{ fontSize: 12 }}>
                          <b>{r.author}</b>
                          <span style={{ color: "var(--color-muted)", marginLeft: 6, fontSize: 11 }}>{r.createdAt.slice(0, 10)}</span>
                        </div>
                        <div style={{ fontSize: 12.5, lineHeight: 1.7 }}>{r.body}</div>
                      </div>
                    ))}
                  </div>
                ))}
                <p style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 6, lineHeight: 1.7 }}>
                  <strong>spam と承認待ちは出ません</strong>（<code>approvedComments()</code>）。
                  返信は <code>parentId</code> で入れ子になります。承認待ちの件数は<strong>管理画面のバッジ</strong>に使います。
                </p>
              </>
            )}
          </div>
        </div>

        <div style={box}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>slug の作り方</h2>
          <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} style={{ marginBottom: 10 }} />
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <tbody>
              {[
                { k: 'slugify(title)', v: slugify(newTitle) || "（空）", note: "**日本語は消えます**（URL に使えない）" },
                { k: 'slugify(title, { allowUnicode: true })', v: slugify(newTitle, { allowUnicode: true }) || "（空）", note: "日本語をそのまま使う" },
                { k: 'ensureSlug(title, "post-6")', v: ensureSlug(newTitle, "post-6"), note: "**空なら fallback**（記事が URL を持てない事態を防ぐ）" },
              ].map((r) => (
                <tr key={r.k} style={{ borderTop: "1px solid var(--color-border)" }}>
                  <td style={{ padding: 5, ...mono, width: 250 }}>{r.k}</td>
                  <td style={{ padding: 5, ...mono, fontWeight: 700 }}>{r.v}</td>
                  <td style={{ padding: 5, fontSize: 11, color: "var(--color-muted)" }}>{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
            <strong>日本語のタイトルから slug は作れません。</strong>
            <code>slugify()</code> は空文字を返すので、<code>ensureSlug()</code> で
            <code>post-6</code> のような fallback を必ず用意します——
            <strong>「記事は作れたが URL が空」を防ぐため</strong>です。
            <br />
            <code>allowUnicode: true</code> なら日本語を使えますが、<strong>URL エンコードで長くなります</strong>
            （SNS でシェアしたときに読めなくなる）。目次のアンカーには使えます。
          </p>
        </div>

        <div style={box}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>公式サイトに要るもの（SEO / RSS / サイトマップ）</h2>

          {seoMeta !== null && (
            <>
              <div style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 6 }}>
                <code>renderMetaTags(buildMeta(...))</code>
              </div>
              <span style={code}>{renderMetaTags(seoMeta.tags)}</span>
            </>
          )}

          <div style={{ fontSize: 12, color: "var(--color-muted)", margin: "10px 0 6px" }}>
            <code>buildRssFeed()</code> — 公開中の {live.length} 件だけが入ります
          </div>
          <span style={code}>{rss}</span>

          <div style={{ fontSize: 12, color: "var(--color-muted)", margin: "10px 0 6px" }}>
            <code>buildSitemap()</code>
          </div>
          <span style={code}>{sitemap}</span>

          <Alert variant="warning" title="RSS とサイトマップに下書きが混ざる事故" style={{ marginTop: 12 }}>
            <span style={{ fontSize: 12, lineHeight: 1.8 }}>
              <strong>`publishedPosts()` を通してから渡すのが要点です。</strong>
              全件をそのまま渡すと、<strong>下書きや予約記事が RSS で配信されます</strong>。
              購読者には届いてしまい、取り消せません。
              <br />
              「今日」を <b>2026-07-25</b> にすると、RSS の件数が {live.length} → {publishedPosts(POSTS, new Date("2026-07-25T00:00:00Z")).length} に増えます。
              <strong>予約公開が RSS にも自動で反映されます</strong>。
            </span>
          </Alert>
        </div>

        <div style={box}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>使っている基盤</h2>
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <tbody>
              {[
                { k: "@platform/blog", v: "28 関数", note: "公開判定・目次・関連記事・RSS・コメント・slug・読了時間" },
                { k: "@platform/seo", v: "meta / JSON-LD", note: "`visibility: \"internal\"` は自動 noindex" },
                { k: "@platform/cms", v: "（実物のみ）", note: "編集画面・権限。デモはモックなので使っていません" },
                { k: "@platform/site", v: "→ /apps/landing", note: "ブロック・バナー・お知らせはランディングのデモで" },
              ].map((r) => (
                <tr key={r.k} style={{ borderTop: "1px solid var(--color-border)" }}>
                  <td style={{ padding: 5, ...mono, width: 140 }}>{r.k}</td>
                  <td style={{ padding: 5, width: 90 }}>
                    <Badge variant="outline">{r.v}</Badge>
                  </td>
                  <td style={{ padding: 5, color: "var(--color-muted)" }}>{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
            <code>buildPermalink(&quot;{PATTERN}&quot;, post)</code> ={" "}
            <b style={mono}>{open !== null ? buildPermalink(PATTERN, open, {}) : "—"}</b>
            <br />
            <strong>URL の形をパターンで持つ</strong>と、後から <code>/blog/:slug</code> へ変えるときに
            1 箇所直せば済みます。<code>matchPermalink()</code> で逆引きもできるので、
            <strong>旧 URL からのリダイレクト</strong>も作れます。
          </p>
        </div>
      </main>
    </div>
  );
}
