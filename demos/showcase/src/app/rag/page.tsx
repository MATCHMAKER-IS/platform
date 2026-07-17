"use client";
/** RAG のデモ: チャンク分割 → 索引 → 権限つき検索 → コンテキスト組み立て。 */
import * as React from "react";
import {
  createRagStore,
  createMemoryVectorIndex,
  buildContext,
  type RagDocument,
  type RagHit,
  type Principal,
  type RagSearchBackend,
} from "@platform/rag";
import { createSearch, createMemorySearch } from "@platform/search";
import { createHashEmbedder } from "@platform/ai";

/** 社内文書(モック)。acl で誰が読めるかを持つ。 */
const DOCS: RagDocument[] = [
  {
    id: "rule-expense",
    title: "経費精算規程",
    source: "総務",
    acl: { public: true },
    body:
      "経費精算は毎月末日までに申請してください。領収書の原本は電子帳簿保存法の要件に従い、スキャナ保存が可能です。" +
      "宿泊費の上限は一泊 12,000 円、日当は 2,000 円です。上限を超える場合は事前に部長承認が必要になります。" +
      "交通費は最安経路を原則とし、特急料金は片道 100km 以上の場合のみ認められます。",
  },
  {
    id: "rule-security",
    title: "情報セキュリティ規程",
    source: "情シス",
    acl: { public: true },
    body:
      "業務データを個人所有の端末へ保存することを禁じます。持ち出しが必要な場合は、暗号化された貸与端末を利用してください。" +
      "パスワードは 12 文字以上とし、他サービスとの使い回しを禁止します。多要素認証は全社員に必須です。" +
      "退職者のアカウントは最終出社日の当日中に無効化します。",
  },
  {
    id: "hr-salary",
    title: "給与テーブル改定案",
    source: "人事",
    acl: { roles: ["hr", "admin"] },
    body:
      "2026 年度より等級 G3 の基本給を 8% 引き上げます。評価は年 2 回、期首の目標設定と期末の達成度で決定します。" +
      "賞与原資は営業利益の 12% を上限とし、部門別の達成率で配分します。この文書は人事部と役員のみ閲覧可能です。",
  },
  {
    id: "board-minutes",
    title: "役員会議事録（2026-06）",
    source: "経営企画",
    acl: { roles: ["admin"] },
    body:
      "基幹システムの内製方針を承認しました。外部ベンダーへの依存を減らし、社内基盤の整備に投資します。" +
      "初年度の予算は 3,000 万円、要員は 4 名。この文書は役員のみ閲覧可能です。",
  },
];

const WHO: Record<string, Principal> = {
  一般社員: { id: "u-staff", roles: ["staff"] },
  人事部: { id: "u-hr", roles: ["staff", "hr"] },
  役員: { id: "u-admin", roles: ["staff", "admin"] },
};

const search = createSearch(createMemorySearch());

const backend: RagSearchBackend = {
  index: (docs) => search.index(docs),
  search: (query, limit) => search.search(query, limit),
  delete: (ids) => search.delete(ids),
};

const rag = createRagStore({
  backend,
  embedder: createHashEmbedder(64),
  vectorIndex: createMemoryVectorIndex(),
  chunk: { maxChars: 160, overlap: 30 },
});

const box: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  background: "var(--color-surface)",
  padding: 16,
  marginBottom: 16,
};

export default function Page() {
  const [ready, setReady] = React.useState(0);
  const [query, setQuery] = React.useState("経費の上限はいくら？");
  const [who, setWho] = React.useState("一般社員");
  const [hits, setHits] = React.useState<RagHit[]>([]);
  const [context, setContext] = React.useState("");
  const [err, setErr] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  // 初回に索引を作る
  React.useEffect(() => {
    let alive = true;
    void (async () => {
      const r = await rag.ingest(DOCS);
      if (!alive) return;
      if (r.ok) setReady(r.value.chunks);
      else setErr(r.error.message);
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function run() {
    setBusy(true);
    setErr("");
    const principal = WHO[who];
    if (!principal) {
      setBusy(false);
      return;
    }
    const r = await rag.retrieve(query, principal, 3);
    if (r.ok) {
      setHits(r.value);
      setContext(buildContext(r.value, { maxChars: 700 }));
    } else {
      setErr(r.error.message);
      setHits([]);
      setContext("");
    }
    setBusy(false);
  }

  return (
    <main style={{ maxWidth: 860, margin: "2.5rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 4 }}>RAG（社内文書検索）</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.8, marginBottom: 20 }}>
        社内文書を分割して索引し、質問に近い箇所を集めて AI へ渡す文脈を組み立てます。
        肝は<strong>権限フィルタ</strong>で、閲覧権の無いチャンクは結果から除外されます
        （<strong>役員でも「全件返す」ことはしません</strong>）。DB も外部 API も使わず、
        BM25 + ハッシュ埋め込みのメモリ索引で動いています。
      </p>

      <div style={box}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <select
            value={who}
            onChange={(e) => setWho(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: "var(--radius)", border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-fg)" }}
          >
            {Object.keys(WHO).map((k) => (
              <option key={k} value={k}>
                {k}として検索
              </option>
            ))}
          </select>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ flex: 1, minWidth: 200, padding: "6px 10px", borderRadius: "var(--radius)", border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-fg)" }}
          />
          <button
            onClick={run}
            disabled={busy || ready === 0}
            style={{ padding: "6px 16px", borderRadius: "var(--radius)", border: "none", background: "var(--color-primary)", color: "var(--color-primary-fg)", cursor: "pointer" }}
          >
            検索
          </button>
        </div>
        <p style={{ fontSize: 12, color: "var(--color-muted)" }}>
          {ready === 0 ? "索引を作成中…" : `${DOCS.length} 文書を ${ready} チャンクに分割して索引済み`}
        </p>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 4 }}>
          「給与テーブル」「役員会」で検索すると、権限による差が分かります。
        </p>
        {err !== "" && <p style={{ color: "var(--color-danger)", fontSize: 13, marginTop: 8 }}>{err}</p>}
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>検索結果（{hits.length} 件）</h2>
        {hits.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--color-muted)" }}>まだありません</p>
        ) : (
          hits.map((h) => (
            <div key={h.chunk.id} style={{ borderTop: "1px solid var(--color-border)", padding: "10px 0" }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>
                {h.chunk.title}
                <span style={{ fontWeight: 400, color: "var(--color-muted)", marginLeft: 8 }}>
                  {h.chunk.source} / score {h.score.toFixed(3)}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--color-muted)", lineHeight: 1.7, marginTop: 4 }}>{h.chunk.text}</div>
            </div>
          ))
        )}
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>AI へ渡す文脈</h2>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 8 }}>
          <code>buildContext()</code> が上限文字数に収まるよう組み立てたもの。これを <code>@platform/ai</code> の
          プロンプトに載せます。
        </p>
        <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, background: "var(--color-bg)", padding: 12, borderRadius: "var(--radius)", margin: 0 }}>
          {context === "" ? "（検索するとここに出ます）" : context}
        </pre>
      </div>
    </main>
  );
}
