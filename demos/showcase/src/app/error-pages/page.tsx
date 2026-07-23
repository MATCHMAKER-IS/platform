"use client";
/**
 * システムエラー画面のデモ（@platform/status-page の各レンダラを実際に描画）。
 * 404 / 500 / 503 / メンテナンス の実画面を iframe でプレビューし、ブランド名や参照IDを反映できる。
 */
import * as React from "react";
import { Badge, Button, Input } from "@platform/ui";
import { renderErrorPage, renderNotFoundPage, renderServiceUnavailablePage, renderMaintenancePage, renderUnauthorizedPage, renderForbiddenPage, renderTooManyRequestsPage } from "@platform/status-page";

const box: React.CSSProperties = { border: "1px solid var(--color-border)", borderRadius: "var(--radius)", background: "var(--color-surface)", padding: 16, marginBottom: 16 };

type Kind = "401" | "403" | "404" | "429" | "500" | "503" | "maintenance";
const KINDS: { key: Kind; label: string; status: number; variant: "warning" | "danger" | "secondary" }[] = [
  { key: "401", label: "認証が必要", status: 401, variant: "warning" },
  { key: "403", label: "権限不足", status: 403, variant: "warning" },
  { key: "404", label: "ページが見つからない", status: 404, variant: "warning" },
  { key: "429", label: "リクエスト過多", status: 429, variant: "warning" },
  { key: "500", label: "内部エラー", status: 500, variant: "danger" },
  { key: "503", label: "一時停止", status: 503, variant: "secondary" },
  { key: "maintenance", label: "メンテナンス中", status: 503, variant: "secondary" },
];

export default function Page() {
  const [kind, setKind] = React.useState<Kind>("500");
  const [brand, setBrand] = React.useState("社内ポータル");
  const [refId, setRefId] = React.useState("trace_a1b2c3");

  const html = React.useMemo(() => {
    const opts = { brand, referenceId: refId, action: { label: "トップへ戻る", href: "/" }, showReload: true } as const;
    switch (kind) {
      case "401": return renderUnauthorizedPage({ brand });
      case "403": return renderForbiddenPage({ brand, referenceId: refId });
      case "429": return renderTooManyRequestsPage({ brand });
      case "404": return renderNotFoundPage({ brand, action: { label: "トップへ戻る", href: "/" } });
      case "500": return renderErrorPage(opts);
      case "503": return renderServiceUnavailablePage(opts);
      case "maintenance": return renderMaintenancePage({ brand, estimatedRecovery: "本日 15:00 頃", referenceId: refId });
    }
  }, [kind, brand, refId]);

  const cur = KINDS.find((k) => k.key === kind)!;

  return (
    <main style={{ maxWidth: 900, margin: "2.5rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 6 }}>システムエラー画面</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 16 }}>404 / 500 / 503 / メンテナンスの実画面を、<code>@platform/status-page</code> で生成してプレビューします。</p>

      <div style={box}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {KINDS.map((k) => (
            <Button key={k.key} type="button" onClick={() => setKind(k.key)}
              style={{ fontSize: 13, padding: "6px 14px", borderRadius: 999, cursor: "pointer", border: "1px solid var(--color-border)", background: kind === k.key ? "var(--color-primary)" : "var(--color-bg)", color: kind === k.key ? "var(--color-primary-fg)" : "var(--color-fg)" }}>
              <Badge variant={k.variant}>{k.status}</Badge> {k.label}</Button>))}
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <label style={{ fontSize: 12, flex: 1, minWidth: 180 }}><div style={{ color: "var(--color-muted)", marginBottom: 4 }}>ブランド名</div><Input value={brand} onChange={(e) => setBrand(e.target.value)} /></label>
          <label style={{ fontSize: 12, flex: 1, minWidth: 180 }}><div style={{ color: "var(--color-muted)", marginBottom: 4 }}>参照ID（サポート問い合わせ用）</div><Input value={refId} onChange={(e) => setRefId(e.target.value)} /></label>
        </div>
      </div>

      <div style={{ ...box, padding: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid var(--color-border)", background: "var(--color-bg)" }}>
          <Badge variant={cur.variant}>HTTP {cur.status}</Badge>
          <span style={{ fontSize: 12, color: "var(--color-muted)" }}>実際に配信される HTML（プレビュー）</span>
        </div>
        <iframe title="error-preview" srcDoc={html} style={{ width: "100%", height: 460, border: "none", background: "#fff" }} sandbox="" />
      </div>

      <p style={{ fontSize: 12, color: "var(--color-muted)", lineHeight: 1.8 }}>
        これらは静的 HTML なので、アプリが落ちていても（フレームワーク非依存で）確実に返せます。エラーの HTTP 変換は
        <code>@platform/http</code> の <code>toHttpError</code>（AppError → ステータス＋ボディ、500系は内部詳細を隠す）が担当します。
      </p>
    </main>
  );
}
