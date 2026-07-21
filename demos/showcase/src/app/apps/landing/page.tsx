"use client";
/**
 * ランディングページのデモ。自社サイトの商品 LP を、**ブロックの並び替えだけ**で作る。
 *
 * UI は **@platform/ui の部品だけ**で組む(CLAUDE.md「UI 部品は @platform/ui を使う」)。
 */
import * as React from "react";
import { Button, Badge, Alert, Separator, Switch, DatePicker } from "@platform/ui";
import {
  visibleBlocks,
  blocksByType,
  activeBanners,
  rotateBanner,
  activeAnnouncements,
  topAnnouncement,
  copyrightText,
  moveBlockUp,
  moveBlockDown,
  type Page,
  type PageBlock,
  type Banner,
  type Announcement,
} from "@platform/site";
import { organizationJsonLd, websiteJsonLd, breadcrumbJsonLd, renderJsonLd, buildMeta, renderMetaTags } from "@platform/seo";

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
};

const BLOCK_LABEL: Record<string, string> = {
  hero: "ヒーロー（大見出し）",
  features: "特長",
  stats: "実績の数字",
  testimonials: "お客様の声",
  pricing: "料金",
  faq: "よくある質問",
  cta: "申し込み導線",
  logos: "導入企業ロゴ",
  steps: "利用の流れ",
  richText: "自由文",
  gallery: "ギャラリー",
  contact: "問い合わせ",
};

const INITIAL: Page = {
  slug: "lp/notebook",
  title: "オリジナルノート A5",
  blocks: [
    { id: "b1", type: "hero", data: { title: "書き心地にこだわった A5 ノート", sub: "1 冊 480 円・50 冊から名入れ可" } },
    { id: "b2", type: "features", data: { count: 3 } },
    { id: "b3", type: "stats", data: {} },
    { id: "b4", type: "pricing", data: {} },
    { id: "b5", type: "testimonials", data: {} },
    { id: "b6", type: "faq", data: {} },
    { id: "b7", type: "cta", data: {} },
    // ★公開前（visibleFrom が未来）。編集画面には出るが、公開ページには出ない。
    { id: "b8", type: "logos", data: {}, visibleFrom: "2027-01-01T00:00:00Z" },
    // ★下書き（visible: false）
    { id: "b9", type: "gallery", data: {}, visible: false },
  ],
};

const BANNERS: Banner[] = [
  { id: "bn1", image: "/banner-a.png", href: "/campaign", alt: "夏のキャンペーン", slot: "hero", weight: 3 },
  { id: "bn2", image: "/banner-b.png", href: "/sponsor", alt: "協賛", slot: "hero", weight: 1, sponsored: true },
];

const ANNOUNCEMENTS: Announcement[] = [
  { id: "a1", message: "8/10〜8/15 は夏季休業です。出荷は 8/16 以降になります。", startAt: "2026-07-01T00:00:00Z", endAt: "2026-09-01T00:00:00Z" },
  { id: "a2", message: "【終了】春の名入れ無料キャンペーン", startAt: "2026-03-01T00:00:00Z", endAt: "2026-04-01T00:00:00Z" },
  { id: "a3", message: "このページ限定：まとめ買いで送料無料", paths: ["/lp"] },
];

export default function Page() {
  const [page, setPage] = React.useState<Page>(INITIAL);
  const [now, setNow] = React.useState("2026-07-17");
  const [preview, setPreview] = React.useState(true);
  const [dismissed, setDismissed] = React.useState<string[]>([]);
  const [seed, setSeed] = React.useState(0.3);

  const nowDate = React.useMemo(() => {
    const d = new Date(`${now}T00:00:00Z`);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }, [now]);

  const shown = visibleBlocks(page, nowDate);
  const ctas = blocksByType(page, "cta");
  const banners = activeBanners(BANNERS, "/lp", { slot: "hero" });
  const banner = rotateBanner(BANNERS, "/lp", { slot: "hero", random: () => seed });
  const anns = activeAnnouncements(ANNOUNCEMENTS, "/lp", { now: nowDate });
  const top = topAnnouncement(ANNOUNCEMENTS, "/lp", { now: nowDate, dismissedIds: dismissed });

  const jsonLd = renderJsonLd([
    organizationJsonLd({ name: "株式会社サンプル", url: "https://example.co.jp", logo: "https://example.co.jp/logo.png", sameAs: ["https://x.com/sample"] }),
    websiteJsonLd({ name: "サンプル公式", url: "https://example.co.jp" }),
    breadcrumbJsonLd([
      { name: "ホーム", url: "https://example.co.jp" },
      { name: "商品", url: "https://example.co.jp/products" },
      { name: page.title, url: `https://example.co.jp/${page.slug}` },
    ]),
  ]);
  const meta = buildMeta({
    title: page.title,
    titleTemplate: "%s | サンプル公式",
    description: "書き心地にこだわった A5 ノート。50 冊から名入れ可。",
    canonical: `https://example.co.jp/${page.slug}`,
    visibility: "public",
  });

  return (
    <main style={{ maxWidth: 900, margin: "2.5rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 4 }}>ランディングページ</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.8, marginBottom: 20 }}>
        自社サイトの商品 LP を<strong>ブロックの並び替えだけ</strong>で作ります。
        <code>@platform/site</code> は<strong>構造と表示条件だけを持ち、見た目はアプリ側</strong>です。
        「公開前のブロック」「期間つきお知らせ」「重み付きバナー」——
        <strong>キャンペーンのたびにコードを直さない</strong>ための仕組みです。
      </p>

      <div style={box}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <Switch checked={preview} onCheckedChange={setPreview} />
            公開ページとして見る（オフ = 編集画面）
          </label>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--color-muted)" }}>
            今日
            <DatePicker value={now} onChange={(e) => setNow(e.target.value)} style={{ width: 150 }} />
          </label>
        </div>
        <p style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 8 }}>
          「今日」を <b>2027-01-02</b> にすると、公開予約していた「導入企業ロゴ」が出ます。
        </p>
      </div>

      {/* お知らせ */}
      {preview && top !== null && (
        <Alert variant="info" title="お知らせ" onDismiss={() => setDismissed((d) => [...d, top.id])} style={{ marginBottom: 16 }}>
          <span style={{ fontSize: 13 }}>{top.message}</span>
        </Alert>
      )}

      <div style={{ display: "grid", gridTemplateColumns: preview ? "1fr" : "1fr 1fr", gap: 16, alignItems: "start" }}>
        {/* 編集画面 */}
        {!preview && (
          <div style={box}>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>ブロックの構成</h2>
            {page.blocks.map((b, i) => {
              const isShown = shown.some((s) => s.id === b.id);
              return (
                <div
                  key={b.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 0",
                    borderTop: i === 0 ? "none" : "1px solid var(--color-border)",
                    opacity: isShown ? 1 : 0.5,
                  }}
                >
                  <span style={{ fontSize: 13, flex: 1 }}>{BLOCK_LABEL[b.type] ?? b.type}</span>
                  {b.visible === false && <Badge variant="secondary">下書き</Badge>}
                  {b.visibleFrom !== undefined && !isShown && <Badge variant="warning">公開予約</Badge>}
                  <Button size="sm" variant="ghost" onClick={() => setPage((p) => ({ ...p, blocks: moveBlockUp(p.blocks, b.id) }))} disabled={i === 0}>
                    ↑
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setPage((p) => ({ ...p, blocks: moveBlockDown(p.blocks, b.id) }))} disabled={i === page.blocks.length - 1}>
                    ↓
                  </Button>
                </div>
              );
            })}
            <p style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.7 }}>
              薄い行は<strong>公開ページに出ません</strong>。編集画面には出るのが要点で、
              「下書きが見えない＝存在を忘れる」を防ぎます。
            </p>
          </div>
        )}

        {/* 公開ページ */}
        <div style={{ ...box, padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "8px 14px", background: "var(--color-bg)", borderBottom: "1px solid var(--color-border)", fontSize: 11, color: "var(--color-muted)" }}>
            https://example.co.jp/{page.slug}
          </div>

          {banner !== null && (
            <div style={{ padding: "10px 14px", background: "color-mix(in srgb, var(--color-primary) 8%, transparent)", borderBottom: "1px solid var(--color-border)", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, flex: 1 }}>{banner.alt}</span>
              {banner.sponsored === true && <Badge variant="outline">PR</Badge>}
            </div>
          )}

          <div style={{ padding: 14 }}>
            {shown.map((b) => (
              <BlockView key={b.id} block={b} />
            ))}
            <Separator style={{ margin: "14px 0" }} />
            <div style={{ fontSize: 11, color: "var(--color-muted)", textAlign: "center" }}>
              {copyrightText({ holder: "株式会社サンプル", startYear: 2020, now: nowDate })}
            </div>
          </div>
        </div>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>バナーのローテーション</h2>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
          <span style={{ fontSize: 12, color: "var(--color-muted)" }}>乱数</span>
          {[0.1, 0.3, 0.5, 0.7, 0.9].map((r) => (
            <Button key={r} size="sm" variant={seed === r ? "primary" : "secondary"} onClick={() => setSeed(r)}>
              {r}
            </Button>
          ))}
          <span style={{ fontSize: 12 }}>
            → <b>{banner?.alt ?? "なし"}</b>
          </span>
        </div>
        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--color-muted)" }}>
              <th style={{ padding: 4 }}>バナー</th>
              <th style={{ padding: 4 }}>重み</th>
              <th style={{ padding: 4 }}>表示枠</th>
              <th style={{ padding: 4 }}>PR 表記</th>
            </tr>
          </thead>
          <tbody>
            {banners.map((b) => (
              <tr key={b.id} style={{ borderTop: "1px solid var(--color-border)" }}>
                <td style={{ padding: 4 }}>{b.alt}</td>
                <td style={{ padding: 4 }}>{b.weight ?? 1}</td>
                <td style={{ padding: 4, color: "var(--color-muted)" }}>{b.slot ?? "—"}</td>
                <td style={{ padding: 4 }}>{b.sponsored === true ? <Badge variant="outline">必要</Badge> : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
          <strong>重み 3:1 で、実際に 3:1 で出ます</strong>（1000 回試行で 750:250 を確認済み）。
          「均等に出す」を自作すると、重み付けが要るときに書き直しになります。
          <br />
          <code>sponsored</code> は<strong>PR 表記の要否</strong>です。景表法対応をデータ側に持たせています。
        </p>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>お知らせ（期間・パス）</h2>
        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--color-muted)" }}>
              <th style={{ padding: 4 }}>お知らせ</th>
              <th style={{ padding: 4 }}>期間</th>
              <th style={{ padding: 4 }}>対象</th>
              <th style={{ padding: 4 }}>いま出るか</th>
            </tr>
          </thead>
          <tbody>
            {ANNOUNCEMENTS.map((a) => {
              const active = anns.some((x) => x.id === a.id);
              return (
                <tr key={a.id} style={{ borderTop: "1px solid var(--color-border)" }}>
                  <td style={{ padding: 4 }}>{a.message.slice(0, 24)}</td>
                  <td style={{ padding: 4, color: "var(--color-muted)" }}>
                    {a.startAt !== undefined ? `${a.startAt.slice(0, 10)}〜${a.endAt?.slice(0, 10) ?? ""}` : "無期限"}
                  </td>
                  <td style={{ padding: 4, color: "var(--color-muted)" }}>{a.paths?.join(", ") ?? "全ページ"}</td>
                  <td style={{ padding: 4 }}>{active ? <Badge variant="success">表示</Badge> : <Badge variant="secondary">非表示</Badge>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
          <strong>期間が過ぎたお知らせは自動で消えます。</strong>「消し忘れて 4 月に春キャンペーンが出ている」を防ぎます。
          <br />
          上の Alert を閉じると、<strong>次のお知らせが出ます</strong>（<code>dismissedIds</code> を渡すため）。
        </p>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>SEO（自社サイトなら必須）</h2>
        <div style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 6 }}>
          <code>renderMetaTags(buildMeta(...))</code>
        </div>
        <span style={code}>{renderMetaTags(meta.tags)}</span>

        <div style={{ fontSize: 12, color: "var(--color-muted)", margin: "10px 0 6px" }}>
          <code>renderJsonLd([organizationJsonLd, websiteJsonLd, breadcrumbJsonLd])</code>
        </div>
        <span style={{ ...code, maxHeight: 200, overflow: "auto" }}>{jsonLd}</span>

        <Alert variant="warning" title="social でも同じ話ですが、ここが一番効きます" style={{ marginTop: 12 }}>
          <span style={{ fontSize: 12, lineHeight: 1.8 }}>
            <code>buildMeta</code> の <code>visibility</code> は
            <strong>「internal（社内）なら自動で noindex」</strong>です。
            社内向けページが検索に載る事故を、<strong>データ側で防ぎます</strong>。
            <br />
            このデモは <code>visibility: &quot;public&quot;</code> なので index されます。
            社内ポータルに同じ部品を使うときは <code>&quot;internal&quot;</code> にするだけです。
          </span>
        </Alert>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>試してみてください</h2>
        <ul style={{ fontSize: 13, lineHeight: 2, margin: 0, paddingLeft: "1.2em", color: "var(--color-muted)" }}>
          <li>
            <strong>「公開ページとして見る」をオフ</strong> → 編集画面。<strong>下書きと公開予約も見えます</strong>
          </li>
          <li>
            <strong>↑↓ でブロックを並び替え</strong> → 公開ページの順序が変わります。<strong>コードは触りません</strong>
          </li>
          <li>
            <strong>今日を 2027-01-02 に</strong> → 公開予約していた「導入企業ロゴ」が出ます
          </li>
          <li>
            <strong>今日を 2026-03-15 に</strong> → 終了済みの「春キャンペーン」が復活します（期間内なので）
          </li>
          <li>
            <strong>お知らせを閉じる</strong> → 次のお知らせに切り替わります
          </li>
          <li>
            <strong>乱数を 0.1 と 0.9 に</strong> → バナーが切り替わります（重み 3:1）
          </li>
        </ul>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 12 }}>
          CTA ブロックは <code>blocksByType(page, &quot;cta&quot;)</code> で <b>{ctas.length}</b> 件。
          「LP に申し込みボタンが 1 つも無い」を検知するのに使えます。
        </p>
      </div>
    </main>
  );
}

/** ブロックの見た目はアプリ側。基盤は構造と表示条件だけを持つ。 */
function BlockView({ block }: { block: PageBlock }) {
  const label = BLOCK_LABEL[block.type] ?? block.type;
  if (block.type === "hero") {
    const d = block.data as { title?: string; sub?: string };
    return (
      <div style={{ padding: "24px 12px", textAlign: "center", background: "var(--color-bg)", borderRadius: "var(--radius)", marginBottom: 10 }}>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>{d.title}</div>
        <div style={{ fontSize: 13, color: "var(--color-muted)" }}>{d.sub}</div>
      </div>
    );
  }
  if (block.type === "cta") {
    return (
      <div style={{ padding: "16px 12px", textAlign: "center", background: "color-mix(in srgb, var(--color-primary) 8%, transparent)", borderRadius: "var(--radius)", marginBottom: 10 }}>
        <Button>見積もりを依頼する</Button>
      </div>
    );
  }
  return (
    <div style={{ padding: "12px", border: "1px dashed var(--color-border)", borderRadius: "var(--radius)", marginBottom: 10, fontSize: 12, color: "var(--color-muted)" }}>
      {label}
    </div>
  );
}
