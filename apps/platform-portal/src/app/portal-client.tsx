"use client";
/** 基盤ポータル。パッケージ検索・カテゴリ絞り込み・ADR・ヘルスを1画面で。 */
import * as React from "react";
import { SkinSelector } from "@platform/ui";

interface ReferenceEntry { name: string; kind: string; summary: string; }
interface PackageInfo { name: string; category: string; summary: string; exports: string[]; hasReadme: boolean; reference: ReferenceEntry[]; }
interface AdrInfo { id: string; title: string; status: string; file: string; }
interface Advisor { sameNameCount: number; similarCount: number; isolated: { name: string; reason: string }[]; }
interface Erd { app: string; mermaid: string; }
interface Appmap { app: string; pages: number; apis: number; flowchart: string; }
interface Depgraph { mermaid: string; topDepended: { name: string; count: number }[]; }
interface Catalog { generatedAt: string; packages: PackageInfo[]; categories: { name: string; count: number }[]; adrs: AdrInfo[]; health: { label: string; value: string }[]; advisor: Advisor; erds: Erd[]; appmaps: Appmap[]; depgraph: Depgraph; }

type Tab = "packages" | "health" | "adr" | "advisor" | "erd";

export function PortalClient({ fetchImpl }: { fetchImpl?: typeof fetch }) {
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;
  const [catalog, setCatalog] = React.useState<Catalog | null>(null);
  const [error, setError] = React.useState("");
  const [tab, setTab] = React.useState<Tab>("packages");
  const [q, setQ] = React.useState("");
  const [cat, setCat] = React.useState<string>("");

  React.useEffect(() => {
    void (async () => {
      const r = await doFetch("/api/catalog");
      if (r.ok) setCatalog((await r.json()) as Catalog);
      else setError("カタログの取得に失敗しました");
    })();
  }, [doFetch]);

  if (error) return <div style={{ padding: 40 }}>{error}</div>;
  if (!catalog) return <div style={{ padding: 40, color: "var(--color-muted, #888)" }}>読み込み中…</div>;

  const query = q.trim().toLowerCase();
  const filtered = catalog.packages.filter((p) => {
    if (cat && p.category !== cat) return false;
    if (!query) return true;
    return p.name.includes(query) || p.summary.toLowerCase().includes(query) || p.exports.some((e) => e.toLowerCase().includes(query));
  });

  const card: React.CSSProperties = { background: "var(--color-surface, #fff)", border: "1px solid #e8e8e8", borderRadius: 10, padding: 16 };
  const tabBtn = (t: Tab, label: string) => (
    <button onClick={() => setTab(t)} style={{ padding: "8px 16px", border: "none", borderBottom: tab === t ? "2px solid #2563eb" : "2px solid transparent", background: "none", fontWeight: tab === t ? 600 : 400, color: tab === t ? "var(--color-primary, #2563eb)" : "var(--color-muted, #666)", cursor: "pointer" }}>{label}</button>
  );

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "24px 24px 64px", background: "var(--color-bg)", color: "var(--color-fg)", minHeight: "100vh" }}>
      <header style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 24, margin: "0 0 4px" }}>Platform Portal</h1>
          <p style={{ color: "var(--color-muted, #888)", fontSize: 13, margin: 0 }}>社内基盤 {catalog.packages.length} パッケージのカタログ・設計判断(ADR)・健康診断。更新: {catalog.generatedAt.slice(0, 10)}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "var(--color-muted, #888)" }}>テーマ</span>
          <SkinSelector variant="dropdown" />
        </div>
      </header>

      <nav style={{ borderBottom: "1px solid #e8e8e8", margin: "16px 0", display: "flex", gap: 4 }}>
        {tabBtn("packages", `パッケージ (${catalog.packages.length})`)}
        {tabBtn("health", "ヘルス")}
        {tabBtn("adr", `ADR (${catalog.adrs.length})`)}
        {tabBtn("advisor", "Advisor")}
        {tabBtn("erd", "設計")}
      </nav>

      {tab === "packages" && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            <input value={q} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQ(e.target.value)} placeholder="名前・説明・export で検索（例: mail, retrieve, createDb）" style={{ flex: 1, minWidth: 240, padding: "8px 12px", border: "1px solid #ddd", borderRadius: 8 }} />
            <select value={cat} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCat(e.target.value)} style={{ padding: "8px 12px", border: "1px solid #ddd", borderRadius: 8 }}>
              <option value="">全カテゴリ</option>
              {catalog.categories.map((c) => <option key={c.name} value={c.name}>{c.name} ({c.count})</option>)}
            </select>
          </div>
          <p style={{ color: "var(--color-muted, #888)", fontSize: 12, margin: "0 0 12px" }}>{filtered.length} 件</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
            {filtered.map((p) => (
              <div key={p.name} style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <code style={{ fontSize: 14, fontWeight: 600, color: "var(--color-primary, #2563eb)" }}>@platform/{p.name}</code>
                  <span style={{ fontSize: 11, color: "var(--color-muted, #999)", background: "#f0f0f0", padding: "2px 8px", borderRadius: 10 }}>{p.category}</span>
                </div>
                <p style={{ fontSize: 13, color: "#555", margin: "8px 0", lineHeight: 1.5 }}>{p.summary || "(説明未整備)"}</p>
                {p.exports.length > 0 && <p style={{ fontSize: 11, color: "var(--color-muted, #999)", margin: 0 }}>export: {p.exports.slice(0, 5).join(", ")}{p.exports.length > 5 ? ` +${p.exports.length - 5}` : ""}</p>}
                {p.reference.length > 0 && (
                  <details style={{ marginTop: 8 }}>
                    <summary style={{ fontSize: 11, color: "var(--color-primary, #2563eb)", cursor: "pointer" }}>API リファレンス（{p.reference.length}）</summary>
                    <div style={{ marginTop: 6, maxHeight: 200, overflowY: "auto" }}>
                      {p.reference.map((r) => (
                        <div key={r.name} style={{ fontSize: 11, padding: "3px 0", borderBottom: "1px solid #f5f5f5" }}>
                          <span style={{ color: "var(--color-muted, #999)" }}>{r.kind}</span> <code style={{ color: "#111" }}>{r.name}</code>
                          {r.summary && <div style={{ color: "#777", marginTop: 2 }}>{r.summary}</div>}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            ))}
            {filtered.length === 0 && <p style={{ color: "var(--color-muted, #999)" }}>該当するパッケージがありません。</p>}
          </div>
        </div>
      )}

      {tab === "health" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
          {catalog.health.map((h, i) => (
            <div key={i} style={card}>
              <div style={{ fontSize: 12, color: "var(--color-muted, #888)" }}>{h.label}</div>
              <div style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>{h.value}</div>
            </div>
          ))}
        </div>
      )}

      {tab === "adr" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {catalog.adrs.map((a) => (
            <div key={a.id} style={{ ...card, display: "flex", alignItems: "center", gap: 12 }}>
              <code style={{ fontSize: 13, color: "var(--color-muted, #999)" }}>{a.id}</code>
              <span style={{ flex: 1, fontSize: 14 }}>{a.title}</span>
              <span style={{ fontSize: 11, color: "#16a34a", background: "#f0fdf4", padding: "2px 10px", borderRadius: 10 }}>{a.status}</span>
            </div>
          ))}
        </div>
      )}

      {tab === "advisor" && (
        <div>
          <p style={{ fontSize: 13, color: "var(--color-muted, #666)", lineHeight: 1.6 }}>新規パッケージを作る前に、上の「パッケージ」タブで既存を検索してください（名前・説明・export を横断）。以下は基盤全体の重複の目安です（層が違えば重複は正当なこともあります）。</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, margin: "12px 0" }}>
            <div style={card}><div style={{ fontSize: 12, color: "var(--color-muted, #888)" }}>同名 export の組</div><div style={{ fontSize: 22, fontWeight: 600 }}>{catalog.advisor.sameNameCount}</div></div>
            <div style={card}><div style={{ fontSize: 12, color: "var(--color-muted, #888)" }}>似た概念の export</div><div style={{ fontSize: 22, fontWeight: 600 }}>{catalog.advisor.similarCount}</div></div>
            <div style={card}><div style={{ fontSize: 12, color: "var(--color-muted, #888)" }}>孤立パッケージ</div><div style={{ fontSize: 22, fontWeight: 600 }}>{catalog.advisor.isolated.length}</div></div>
          </div>
          {catalog.advisor.isolated.length > 0 && (
            <div style={card}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>孤立パッケージ</div>
              {catalog.advisor.isolated.map((i) => <div key={i.name} style={{ fontSize: 13, padding: "4px 0" }}><code>@platform/{i.name}</code> — {i.reason}</div>)}
            </div>
          )}
          <p style={{ fontSize: 12, color: "var(--color-muted, #999)", marginTop: 12 }}>詳細な重複リストは <code>node tools/advisor.mjs report</code> →  docs/ai/advisor-report.md。</p>
        </div>
      )}

      {tab === "erd" && (
        <div>
          {catalog.depgraph.mermaid && (
            <div style={{ ...card, marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>パッケージ依存グラフ（カテゴリ間）</div>
              <pre style={{ fontSize: 11, background: "var(--color-bg, #f8f8f8)", padding: 12, borderRadius: 8, overflowX: "auto", lineHeight: 1.5 }}><code>{catalog.depgraph.mermaid}</code></pre>
              <div style={{ fontSize: 12, color: "var(--color-muted, #666)", marginTop: 8 }}>よく使われる基盤: {catalog.depgraph.topDepended.slice(0, 6).map((d) => `${d.name}(${d.count})`).join(" · ")}</div>
            </div>
          )}
          <div style={{ ...card, marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>アプリ別 画面・API 規模</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr style={{ color: "var(--color-muted, #888)", textAlign: "left", borderBottom: "1px solid #eee" }}><th style={{ padding: 4 }}>アプリ</th><th>画面</th><th>API</th></tr></thead>
              <tbody>{catalog.appmaps.map((m) => <tr key={m.app} style={{ borderBottom: "1px solid #f5f5f5" }}><td style={{ padding: 4 }}>{m.app}</td><td>{m.pages}</td><td>{m.apis}</td></tr>)}</tbody>
            </table>
            <p style={{ fontSize: 11, color: "var(--color-muted, #999)", marginTop: 6 }}>詳細一覧は docs/platform/appmap/*.md（<code>node tools/gen-app-map.mjs</code>）。</p>
          </div>
          {catalog.appmaps.filter((m) => m.flowchart).map((m) => (
            <div key={m.app} style={{ ...card, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{m.app} 画面遷移</div>
              <pre style={{ fontSize: 11, background: "var(--color-bg, #f8f8f8)", padding: 12, borderRadius: 8, overflowX: "auto", lineHeight: 1.5 }}><code>{m.flowchart}</code></pre>
            </div>
          ))}
          <p style={{ fontSize: 13, color: "var(--color-muted, #666)" }}>各アプリの Prisma スキーマから自動生成した ER 図(Mermaid）。<code>node tools/gen-erd.mjs</code> で再生成。</p>
          {catalog.erds.map((e) => (
            <div key={e.app} style={{ ...card, marginTop: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{e.app}</div>
              <pre style={{ fontSize: 11, background: "var(--color-bg, #f8f8f8)", padding: 12, borderRadius: 8, overflowX: "auto", lineHeight: 1.5 }}><code>{e.mermaid}</code></pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
