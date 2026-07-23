"use client";
/**
 * ソーシャル連携のデモ。自社サイトの SNS アカウント表示・シェアボタン・投稿の取り込み。
 *
 * UI は **@platform/ui の部品だけ**で組む(CLAUDE.md「UI 部品は @platform/ui を使う」)。
 */
import * as React from "react";
import { Button, Input, Textarea, Badge, Alert, Separator, Select } from "@platform/ui";
import {
  accountsFromUrls,
  dedupeAccounts,
  sortAccounts,
  accountLinks,
  normalizeHandle,
  canonicalHandle,
  isValidHandle,
  displayHandle,
  buildProfileUrl,
  parseSocialUrl,
  isSocialUrl,
  platformFromHostname,
  shareUrl,
  shareLinks,
  SHARE_LABELS,
  PLATFORMS,
  ALL_PLATFORMS,
  oembedEndpoint,
  supportsOEmbed,
  postKey,
  mergeSocialFeed,
  groupByPlatform,
  newPosts,
  recentPosts,
  type SocialPlatform,
  type SharePlatform,
  type ShareTarget,
  type SocialPost,
} from "@platform/social";

const box: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  background: "var(--color-surface)",
  padding: 16,
  marginBottom: 16,
};

const mono: React.CSSProperties = { fontFamily: "monospace", fontSize: 12, wordBreak: "break-all" };

const code: React.CSSProperties = {
  ...mono,
  display: "block",
  background: "var(--color-bg)",
  border: "1px solid var(--color-border)",
  borderRadius: 4,
  padding: "6px 8px",
  lineHeight: 1.6,
};

/** 担当者が貼り付けてくる URL。**表記がバラバラなのが現実**。 */
const PASTED = `https://x.com/sample_co
https://twitter.com/sample_co
https://www.tiktok.com/@sample_co
https://instagram.com/sample_co/
https://example.co.jp/not-social
https://x.com/@Sample_Co`;

/** 取り込んだ投稿（実際の取得は API 経由・要認証）。 */
const POSTS: SocialPost[] = [
  { platform: "x", id: "1801", url: "https://x.com/sample_co/status/1801", text: "新商品のノートを発売しました", createdAt: "2026-07-17T09:00:00Z", likeCount: 42 },
  { platform: "instagram", id: "ig-9", url: "https://instagram.com/p/ig-9", text: "工場見学の様子", createdAt: "2026-07-16T14:00:00Z", kind: "reel", likeCount: 120 },
  { platform: "x", id: "1799", url: "https://x.com/sample_co/status/1799", text: "夏季休業のお知らせ", createdAt: "2026-07-15T10:00:00Z", likeCount: 8 },
  { platform: "tiktok", id: "tt-3", url: "https://www.tiktok.com/@sample_co/video/tt-3", text: "組み立て 30 秒", createdAt: "2026-07-17T12:00:00Z", kind: "video", likeCount: 350 },
  // ★重複（同じ投稿を 2 回取得してしまった）
  { platform: "x", id: "1801", url: "https://x.com/sample_co/status/1801", text: "新商品のノートを発売しました", createdAt: "2026-07-17T09:00:00Z", likeCount: 45 },
];

const SHARE_TARGETS: SharePlatform[] = ["x", "facebook", "line", "hatena", "email"];

export function SocialDemo() {
  const [pasted, setPasted] = React.useState(PASTED);
  const [handle, setHandle] = React.useState("@Sample_Co");
  const [platform, setPlatform] = React.useState<SocialPlatform>("x");
  const [url, setUrl] = React.useState("https://x.com/sample_co/status/1234567890");
  const [known, setKnown] = React.useState<string[]>(["x:1799"]);

  const urls = pasted.split("\n").map((s) => s.trim()).filter((s) => s !== "");
  const accounts = sortAccounts(dedupeAccounts(accountsFromUrls(urls)));
  const links = accountLinks(accounts);
  const parsed = parseSocialUrl(url);

  const target: ShareTarget = {
    url: "https://example.co.jp/products/notebook",
    title: "書き心地にこだわった A5 ノート",
    hashtags: ["サンプル", "文房具"],
    via: "sample_co",
  };

  const merged = mergeSocialFeed(POSTS);
  const grouped = groupByPlatform(merged);
  const fresh = newPosts(merged, known);

  return (
    <>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 4 }}>ソーシャル連携</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.8, marginBottom: 20 }}>
        自社サイトの SNS アカウント表示・シェアボタン・投稿の取り込み。
        <code>@platform/social</code> は<strong>純ロジック</strong>です
        （実際の API 取得・投稿は認証が要るのでアプリ側）。
        <strong>URL の表記ゆれを吸収する</strong>のが一番の仕事です。
      </p>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>① 貼り付けられた URL から一覧を作る</h2>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 8, lineHeight: 1.8 }}>
          担当者は<strong>表記がバラバラな URL を貼ってきます</strong>。
          <code>x.com</code> と <code>twitter.com</code>、末尾スラッシュ、<code>@</code> 付き、
          同じアカウントの重複、無関係な URL——全部混ざります。
        </p>
        <Textarea value={pasted} onChange={(e) => setPasted(e.target.value)} rows={6} style={{ marginBottom: 10, fontFamily: "monospace", fontSize: 12 }} />

        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--color-muted)" }}>
              <th style={{ padding: 5 }}>プラットフォーム</th>
              <th style={{ padding: 5 }}>ハンドル</th>
              <th style={{ padding: 5 }}>表示</th>
              <th style={{ padding: 5 }}>URL</th>
            </tr>
          </thead>
          <tbody>
            {links.map((l) => (
              <tr key={l.platform} style={{ borderTop: "1px solid var(--color-border)" }}>
                <td style={{ padding: 5 }}>
                  <Badge variant="secondary">{PLATFORMS[l.platform].label}</Badge>
                </td>
                <td style={{ padding: 5, ...mono }}>{accounts.find((a) => a.platform === l.platform)?.handle}</td>
                <td style={{ padding: 5, ...mono }}>{l.label}</td>
                <td style={{ padding: 5, ...mono, color: "var(--color-muted)" }}>{l.url}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <Alert variant="success" title={`${urls.length} 行 → ${accounts.length} アカウント`} style={{ marginTop: 12 }}>
          <span style={{ fontSize: 12, lineHeight: 1.8 }}>
            <strong><code>twitter.com</code> と <code>x.com</code> が同じ 1 件にまとまります</strong>
            （旧ドメインを知っているため）。<code>@Sample_Co</code> の大文字も
            <code>sample_co</code> に正規化され、重複として除かれます。
            <br />
            <strong>無関係な URL は静かに落ちます</strong>（エラーにしない）。
            「1 件でも変な URL があると全部登録できない」を防ぐためです。
          </span>
        </Alert>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>② ハンドルの正規化と検証</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <Select
            value={platform}
            onChange={(e) => setPlatform(e.target.value as SocialPlatform)}
            options={ALL_PLATFORMS.map((p) => ({ label: PLATFORMS[p].label, value: p }))}
            style={{ width: 130 }}
          />
          <Input value={handle} onChange={(e) => setHandle(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
          <Badge variant={isValidHandle(platform, normalizeHandle(handle)) ? "success" : "danger"}>
            {isValidHandle(platform, normalizeHandle(handle)) ? "有効" : "無効"}
          </Badge>
        </div>

        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <tbody>
            {[
              { k: "normalizeHandle()", v: normalizeHandle(handle), note: "@ と空白を落とす" },
              { k: "canonicalHandle()", v: canonicalHandle(handle), note: "小文字に（重複判定用）" },
              { k: "displayHandle()", v: displayHandle(platform, normalizeHandle(handle)), note: "画面に出す形" },
              { k: "buildProfileUrl()", v: buildProfileUrl(platform, normalizeHandle(handle)) ?? "—", note: "無効なら null" },
            ].map((r) => (
              <tr key={r.k} style={{ borderTop: "1px solid var(--color-border)" }}>
                <td style={{ padding: 5, ...mono, width: 160 }}>{r.k}</td>
                <td style={{ padding: 5, ...mono, fontWeight: 700 }}>{r.v}</td>
                <td style={{ padding: 5, fontSize: 11, color: "var(--color-muted)" }}>{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
          <strong>プラットフォームごとに規則が違います</strong>——
          X は英数字と <code>_</code> で <b>15 字まで</b>、TikTok は <code>.</code> も可で <b>2〜24 字</b>・
          <strong>表示に <code>@</code> が付く</strong>、Instagram は <b>30 字まで</b>。
          <br />
          プラットフォームを切り替えて、<code>sample.co</code>（ドット入り）や
          16 字以上を試してみてください。<strong>X だけ無効になります</strong>。
        </p>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>③ URL の解析</h2>
        <Input value={url} onChange={(e) => setUrl(e.target.value)} style={{ marginBottom: 10 }} />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {[
            "https://x.com/sample_co/status/1234567890",
            "https://www.tiktok.com/@sample_co",
            "https://instagram.com/p/ABC123",
            "https://twitter.com/sample_co",
            "https://example.co.jp/",
          ].map((u) => (
            <Button key={u} size="sm" variant={url === u ? "primary" : "secondary"} onClick={() => setUrl(u)}>
              {u.replace("https://", "").slice(0, 24)}
            </Button>
          ))}
        </div>

        {parsed === null ? (
          <Alert variant="warning" title="ソーシャルの URL ではありません">
            <span style={{ fontSize: 12 }}>
              <code>isSocialUrl()</code> = {String(isSocialUrl(url))} / <code>platformFromHostname()</code> ={" "}
              {platformFromHostname(url.replace(/^https?:\/\//, "").split("/")[0] ?? "") ?? "null"}
            </span>
          </Alert>
        ) : (
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <tbody>
              {[
                { k: "platform", v: parsed.platform },
                { k: "type", v: parsed.type },
                { k: "handle", v: parsed.handle ?? "—" },
                { k: "postId", v: parsed.postId ?? "—" },
              ].map((r) => (
                <tr key={r.k} style={{ borderTop: "1px solid var(--color-border)" }}>
                  <td style={{ padding: 5, ...mono, width: 90, color: "var(--color-muted)" }}>{r.k}</td>
                  <td style={{ padding: 5, ...mono, fontWeight: 700 }}>{r.v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10 }}>
          <strong><code>type</code> が <code>profile</code> か <code>post</code> か</strong>を見分けます。
          「アカウントを登録したつもりが投稿 URL だった」を防げます。
        </p>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>④ シェアボタン</h2>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {shareLinks(SHARE_TARGETS, target).map((l) => (
            <Button key={l.platform} size="sm" variant="secondary" onClick={() => window.open(l.url, "_blank", "noopener")}>
              {l.label}
            </Button>
          ))}
        </div>
        <div style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 6 }}>
          <code>shareUrl(&quot;x&quot;, target)</code>
        </div>
        <span style={code}>{shareUrl("x", target)}</span>
        <div style={{ fontSize: 12, color: "var(--color-muted)", margin: "8px 0 6px" }}>
          <code>shareUrl(&quot;line&quot;, target)</code>
        </div>
        <span style={code}>{shareUrl("line", target)}</span>

        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
          <strong>URL エンコードを手で書かないための関数です。</strong>
          ハッシュタグの区切り（カンマ）、<code>via</code>（投稿元アカウント）、
          はてなが <code>https://</code> を落とす仕様——<strong>全部プラットフォームごとに違います</strong>。
          <br />
          <code>SHARE_LABELS</code> に <b>{Object.keys(SHARE_LABELS).length}</b> 種類の表示名があります。
        </p>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>⑤ 投稿の取り込み</h2>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontSize: 13, marginBottom: 12 }}>
          <span>
            取得 <b>{POSTS.length}</b> 件
          </span>
          <span>
            重複除去後 <b style={{ color: "var(--color-success)" }}>{merged.length}</b> 件
          </span>
          <span>
            新着 <b style={{ color: "var(--color-primary)" }}>{fresh.length}</b> 件
          </span>
        </div>

        {recentPosts(merged, 4).map((p) => {
          const isNew = fresh.some((f) => postKey(f) === postKey(p));
          return (
            <div key={postKey(p)} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 0", borderTop: "1px solid var(--color-border)" }}>
              <Badge variant="secondary">{PLATFORMS[p.platform].label}</Badge>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13 }}>
                  {p.text}
                  {isNew && (
                    <Badge variant="danger" style={{ marginLeft: 6 }}>
                      新着
                    </Badge>
                  )}
                </div>
                <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 2 }}>
                  {p.createdAt.slice(0, 16).replace("T", " ")}
                  {p.likeCount !== undefined && ` · ♥ ${p.likeCount}`}
                  {p.kind !== undefined && ` · ${p.kind}`}
                </div>
              </div>
            </div>
          );
        })}

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <Button size="sm" variant="secondary" onClick={() => setKnown(merged.map(postKey))}>
            全部「既読」にする
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setKnown(["x:1799"])}>
            戻す
          </Button>
        </div>

        <Separator style={{ margin: "14px 0" }} />

        <div style={{ fontSize: 12, color: "var(--color-muted)", lineHeight: 1.9 }}>
          <strong>プラットフォーム別</strong>:{" "}
          {ALL_PLATFORMS.map((p) => `${PLATFORMS[p].label} ${grouped[p]?.length ?? 0} 件`).join(" / ")}
        </div>

        <Alert variant="info" title="重複除去が要点です" style={{ marginTop: 10 }}>
          <span style={{ fontSize: 12, lineHeight: 1.8 }}>
            <strong>同じ投稿を 2 回取得してしまうのは普通に起きます</strong>
            （ページング、再取得、複数の API 呼び出し）。
            <code>mergeSocialFeed()</code> が <code>platform:id</code> で重複を除き、
            <strong>時系列に並べ直します</strong>。
            <br />
            <code>newPosts(posts, knownKeys)</code> は<strong>「まだ見ていない投稿」だけ</strong>を返します。
            「サイトに新着として出すのは初回だけ」を実現するのに使います。
          </span>
        </Alert>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>⑥ 埋め込み（oEmbed）</h2>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--color-muted)" }}>
              <th style={{ padding: 5 }}>プラットフォーム</th>
              <th style={{ padding: 5 }}>oEmbed</th>
              <th style={{ padding: 5 }}>エンドポイント</th>
            </tr>
          </thead>
          <tbody>
            {ALL_PLATFORMS.map((p) => {
              const ep = oembedEndpoint(p, `${PLATFORMS[p].profileBase}/sample_co/status/1`, { maxWidth: 400 });
              return (
                <tr key={p} style={{ borderTop: "1px solid var(--color-border)" }}>
                  <td style={{ padding: 5 }}>{PLATFORMS[p].label}</td>
                  <td style={{ padding: 5 }}>
                    <Badge variant={supportsOEmbed(p) ? "success" : "warning"}>{supportsOEmbed(p) ? "対応" : "要トークン"}</Badge>
                  </td>
                  <td style={{ padding: 5, ...mono, color: "var(--color-muted)" }}>{ep ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
          <strong>Instagram は null を返します</strong>——アクセストークンが必要で、
          エンドポイントだけでは埋め込めないためです。
          <strong>「対応している風に見せて実は動かない」を避ける</strong>ための正直な設計です。
          <br />
          埋め込む HTML の扱いは <code>/safe-html</code> の <code>embedIframe()</code> と組み合わせます。
        </p>
      </div>
    </>
  );
}
