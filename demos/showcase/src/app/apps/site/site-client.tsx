"use client";
/**
 * 公開サイトのデモ(モックデータ)。
 *
 * **実物は `apps/public-site`**(10 画面)。ブログ・お知らせ・問い合わせを CMS で運用する。
 */
import * as React from "react";
import { publishedPosts, tagCounts, type BlogPost } from "@platform/blog";
import { readingTime } from "@platform/blog";

const NOW = new Date("2026-07-15T00:00:00Z");
const base = { author: "広報", createdAt: "2026-06-01T00:00:00Z", updatedAt: "2026-06-01T00:00:00Z" };

/**
 * デモ用の記事。
 *
 * `BlogPost` は index signature(`[key: string]: unknown`)を持つので、
 * `body` や `excerpt` を直接読むと `unknown` になる。使うフィールドを明示する。
 */
type DemoPost = BlogPost & { body: string; excerpt: string };

const POSTS: DemoPost[] = [
  { id: "p1", slug: "release-v2", title: "新バージョンをリリースしました", body: "# 新機能\n\n経費精算がスマホから使えるようになりました。領収書を撮るだけで、科目を自動で推定します。\n\n## 使い方\n\nアプリを開いて「経費」→「撮影」を選んでください。", excerpt: "経費精算がスマホから使えるようになりました",
    category: "お知らせ", tags: ["リリース", "経費"], status: "published", publishedAt: "2026-07-10T00:00:00Z", ...base },
  { id: "p2", slug: "security-update", title: "セキュリティ強化のお知らせ", body: "二要素認証を必須にします。\n\n7 月末までに設定をお願いします。", excerpt: "二要素認証を必須にします",
    category: "お知らせ", tags: ["セキュリティ"], status: "published", publishedAt: "2026-07-05T00:00:00Z", ...base },
  { id: "p3", slug: "interview-01", title: "現場の声: 情シスの一日", body: "朝、出社してまず見るのは「今日やること」の画面です。契約の更新期限、期限切れのタスク、直すべき FAQ が並んでいます。", excerpt: "朝、出社してまず見るのは「今日やること」の画面です",
    category: "コラム", tags: ["インタビュー"], status: "published", publishedAt: "2026-06-28T00:00:00Z", ...base },
  { id: "p4", slug: "draft-post", title: "(下書き)次期ロードマップ", body: "未公開", excerpt: "",
    category: "お知らせ", tags: [], status: "draft", ...base },
];

export function SiteDemo() {
  const posts = publishedPosts(POSTS, NOW);
  const tags = tagCounts(POSTS);
  const [selected, setSelected] = React.useState<string | null>(null);
  const shown = selected ? posts.filter((p) => (p.tags ?? []).includes(selected)) : posts;

  return (
    <div>
      <div style={banner}>
        これは <strong>デモ</strong> です。実物は <code>apps/public-site</code>(10 画面)。ここは<strong>モックデータ</strong>です。
      </div>

      <div style={{ padding: 16, maxWidth: 900 }}>
        <h2 style={{ fontSize: 18, margin: "0 0 4px" }}>公開サイト</h2>
        <p style={{ fontSize: 12, color: "var(--color-muted)", margin: "0 0 16px" }}>
          全 {POSTS.length} 件中、公開中は {posts.length} 件(下書きは出ません)
        </p>

        <div style={{ display: "flex", gap: 4, marginBottom: 12, flexWrap: "wrap" }}>
          <button onClick={() => setSelected(null)} style={{ ...tagBtn, background: selected === null ? "var(--color-primary)" : "var(--color-surface)", color: selected === null ? "var(--color-primary-fg, #fff)" : "var(--color-fg)" }}>
            すべて
          </button>
          {tags.map((t) => (
            <button key={t.tag} onClick={() => setSelected(t.tag)}
              style={{ ...tagBtn, background: selected === t.tag ? "var(--color-primary)" : "var(--color-surface)", color: selected === t.tag ? "var(--color-primary-fg, #fff)" : "var(--color-fg)" }}>
              {t.tag} <span style={{ opacity: 0.7 }}>{t.count}</span>
            </button>
          ))}
        </div>

        {shown.map((p) => (
          <article key={p.id} style={{ ...card, marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: "var(--color-muted)", marginBottom: 4 }}>
              {p.publishedAt?.slice(0, 10)} ・ {p.category} ・ 約 {readingTime(p.body).minutes} 分で読めます
            </div>
            <h3 style={{ fontSize: 15, margin: "0 0 6px" }}>{p.title}</h3>
            <p style={{ fontSize: 12.5, color: "var(--color-muted)", margin: "0 0 8px", lineHeight: 1.7 }}>{p.excerpt}</p>
            <div style={{ display: "flex", gap: 4 }}>
              {(p.tags ?? []).map((t) => (
                <span key={t} style={{ fontSize: 10, padding: "2px 6px", borderRadius: 999, background: "var(--color-bg)", border: "1px solid var(--color-border)", color: "var(--color-muted)" }}>
                  {t}
                </span>
              ))}
            </div>
          </article>
        ))}

        <p style={note}>
          読了時間は <code>@platform/blog</code> が推定します(<strong>日本語と英語で読む速さが違う</strong>ので文字種で判定・最低 1 分)。
          記事の公開・予約は <code>@platform/cms</code>、SEO は <code>@platform/seo</code>。
        </p>
      </div>
    </div>
  );
}

const banner: React.CSSProperties = { padding: "10px 16px", fontSize: 12, lineHeight: 1.7, background: "var(--color-surface)", borderBottom: "1px solid var(--color-border)", color: "var(--color-muted)" };
const card: React.CSSProperties = { background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius, 10px)", padding: 14 };
const tagBtn: React.CSSProperties = { padding: "4px 12px", fontSize: 12, cursor: "pointer", borderRadius: 999, border: "1px solid var(--color-border)" };
const note: React.CSSProperties = { fontSize: 11.5, color: "var(--color-muted)", marginTop: 12, lineHeight: 1.7 };
