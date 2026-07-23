"use client";
/**
 * 社内資料アシスタント（RAG の検索〜文脈組み立てまで）。
 *
 * 「どうやって復元するの？」のような質問に、社内の手順書・規約・設計判断(ADR)から
 * 該当箇所を探して見せる。RAG の流れをそのまま画面にしている:
 *
 *   1. 探す(Retrieval)   … @platform/search の BM25 で関連する節を取り出す
 *   2. 組み立てる(Augmentation) … @platform/rag の buildContext で文脈にまとめる
 *   3. 答える(Generation) … 組み立てた文脈を LLM に渡す（鍵が要るため、ここでは
 *                            送るプロンプトを表示するに留める）
 *
 * 索引は `node tools/gen-docs-index.mts` が作る静的ファイル（画面を開いたときだけ取得）。
 * 外部 API も鍵も不要で、ブラウザの中だけで検索が完結する。
 */
import * as React from "react";
import { createBm25Index } from "@platform/search";
import { buildContext, textToDocument, chunkDocument, boostExactKeyword } from "@platform/rag";
import { Button, Input, Badge, Alert } from "@platform/ui";

type Entry = { f: string; h: string; b: string; t: string; x: boolean; p?: string };
type Index = { generatedAt: string; count: number; entries: Entry[] };
type Hit = { entry: Entry; score: number };

const box: React.CSSProperties = { border: "1px solid var(--color-border)", borderRadius: "var(--radius)", background: "var(--color-surface)", padding: 16, marginBottom: 16 };
const mono: React.CSSProperties = { fontFamily: "monospace", fontSize: 11.5, whiteSpace: "pre-wrap", wordBreak: "break-word" };

const EXAMPLES = [
  "バックアップから復元する手順",
  "なぜ db push を使っているのか",
  "生タグの上限はどう運用するのか",
  "外部サービスの API 変更に気づく方法",
  "新しく入った人は何から始めるか",
];

/** 本文から質問語の周辺を抜き出す。 */
function excerpt(text: string, query: string, max = 260): string {
  const flat = text.replace(/\s+/g, " ").trim();
  const terms = query.split(/\s+/).filter((t) => t.length >= 2);
  let at = -1;
  for (const t of terms) {
    const i = flat.toLowerCase().indexOf(t.toLowerCase());
    if (i >= 0) { at = i; break; }
  }
  if (at < 0) return flat.slice(0, max) + (flat.length > max ? "…" : "");
  const start = Math.max(0, at - 60);
  return (start > 0 ? "…" : "") + flat.slice(start, start + max) + (start + max < flat.length ? "…" : "");
}

export default function Page() {
  const [index, setIndex] = React.useState<Index | null>(null);
  const [error, setError] = React.useState("");
  const [q, setQ] = React.useState("");
  const [hits, setHits] = React.useState<Hit[] | null>(null);
  const [context, setContext] = React.useState("");
  const [showPrompt, setShowPrompt] = React.useState(false);
  const [answer, setAnswer] = React.useState<{ ok: boolean; text: string; hint?: string; meta?: Record<string, unknown> } | null>(null);
  const [generating, setGenerating] = React.useState(false);
  const bm25 = React.useRef<ReturnType<typeof createBm25Index> | null>(null);

  // 索引は画面を開いたときだけ取得する（初回表示を重くしないため）
  React.useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await fetch("/docs-index.json");
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as Index;
        if (!alive) return;
        const idx = createBm25Index({ fieldBoosts: { pkg: 8, heading: 3, breadcrumb: 2, file: 2, body: 1 } });
        idx.addAll(data.entries.map((e, i) => ({ id: String(i), pkg: e.p ?? "", heading: e.h, breadcrumb: e.b, file: e.f, body: e.t })));
        bm25.current = idx;
        setIndex(data);
      } catch {
        if (alive) setError("索引を読み込めませんでした（node tools/gen-docs-index.mts で生成できます）");
      }
    })();
    return () => { alive = false; };
  }, []);

  const ask = (question: string) => {
    const idx = bm25.current;
    if (!idx || !index) return;
    const query = question.trim();
    if (query === "") return;
    setQ(query);
    setShowPrompt(false);
    setAnswer(null);

    // 1. 探す
    // 多めに取ってから、部品名の完全一致を優先して並べ替える（基盤の boostExactKeyword）
    const pool = idx.search(query, 60).map((h) => ({ entry: index.entries[Number(h.id)]!, score: h.score }));
    const found = boostExactKeyword(pool, query, (h) => h.entry.p).slice(0, 5);
    setHits(found);

    // 2. 組み立てる（基盤の buildContext を実際に使う）
    const ragHits = found.map((h, i) => ({
      chunk: chunkDocument(textToDocument({
        id: `s${i}`,
        title: `${h.entry.h}（${h.entry.f}）`,
        text: h.entry.t,
        source: h.entry.f,
      }))[0]!,
      score: h.score,
    }));
    setContext(buildContext(ragHits, { maxChars: 3000 }));
  };

  /** サーバ経由で回答を生成する（鍵はサーバ側にしか置かない）。 */
  const generate = async () => {
    setGenerating(true);
    setAnswer(null);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, context }),
      });
      const data = (await res.json()) as { ok: boolean; answer?: string; message?: string; hint?: string; meta?: Record<string, unknown> };
      setAnswer(data.ok
        ? { ok: true, text: data.answer ?? "", meta: data.meta }
        : { ok: false, text: data.message ?? "生成できませんでした", hint: data.hint });
    } catch {
      setAnswer({ ok: false, text: "サーバに繋がりませんでした" });
    } finally {
      setGenerating(false);
    }
  };

  const prompt = `あなたは社内基盤の案内役です。次の資料だけを根拠に、日本語で簡潔に答えてください。
資料に書かれていないことは「資料には見当たりません」と答えてください。
回答の最後に、根拠にした資料のパスを列挙してください。

# 質問
${q}

# 資料
${context}`;

  return (
    <main style={{ maxWidth: 880, margin: "2.5rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 6 }}>社内資料アシスタント（RAG）</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 16 }}>
        社内の手順書・規約・設計判断から、質問に関係する箇所を探して文脈にまとめます。
        <strong>検索はブラウザの中だけで完結</strong>し、外部 API も鍵も使いません。
      </p>

      {error !== "" && <div style={{ marginBottom: 16 }}><Alert variant="danger">{error}</Alert></div>}

      <div style={box}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="例: バックアップから復元する手順"
            onKeyDown={(e) => { if (e.key === "Enter") ask(q); }} style={{ flex: "1 1 320px" }} />
          <Button onClick={() => ask(q)} disabled={index === null || q.trim() === ""}>探す</Button>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {EXAMPLES.map((e) => (
            <Button key={e} size="sm" variant="secondary" onClick={() => ask(e)} disabled={index === null}>{e}</Button>
          ))}
        </div>
        <div style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10 }}>
          {index === null && error === "" ? "索引を読み込み中…" : index !== null ? `索引: ${index.count} 節（生成 ${index.generatedAt}）` : null}
        </div>
      </div>

      {hits !== null && (
        <div style={box}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>1. 探す（Retrieval）</span>
            <Badge variant="secondary">{hits.length} 件</Badge>
          </div>
          {hits.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--color-muted)" }}>関係する記述が見つかりませんでした。言い回しを変えてみてください。</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {hits.map((h, i) => (
                <div key={i} style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, background: "var(--color-bg)" }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{h.entry.h}</div>
                  <div style={{ fontSize: 11.5, color: "var(--color-muted)", margin: "2px 0 6px" }}>
                    <code>{h.entry.f}</code>{h.entry.b && h.entry.b !== h.entry.h ? ` — ${h.entry.b}` : ""}（一致度 {h.score.toFixed(1)}）
                  </div>
                  <div style={{ fontSize: 12.5, lineHeight: 1.8 }}>{excerpt(h.entry.t, q)}</div>
                  {h.entry.x && <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 4 }}>※ 索引では途中まで。全文は元ファイルを開いてください</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {context !== "" && (
        <div style={box}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>2. 組み立てる（Augmentation）</div>
          <p style={{ fontSize: 12.5, color: "var(--color-muted)", lineHeight: 1.8, marginTop: 0 }}>
            見つけた節を <code>@platform/rag</code> の <code>buildContext</code> で 1 つの文脈にまとめます。
            上限（ここでは 3000 文字）を超える分は落とすので、長い資料でも LLM の入力に収まります。
          </p>
          <pre style={{ ...mono, margin: 0, padding: 12, borderRadius: 6, background: "var(--color-bg)", border: "1px solid var(--color-border)", maxHeight: 260, overflow: "auto" }}>{context}</pre>
        </div>
      )}

      {context !== "" && (
        <div style={box}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>3. 答える（Generation）</div>
          <p style={{ fontSize: 12.5, color: "var(--color-muted)", lineHeight: 1.8, marginTop: 0 }}>
            組み立てた文脈を LLM へ渡します。送信は<strong>必ずサーバ側の AI ゲートウェイ経由</strong>です
            （鍵を画面に置かない・利用量と費用を必ず記録する。<a href="/ai" style={{ color: "var(--color-primary)" }}>/ai</a>）。
            鍵が設定されていない環境では、何を設定すればよいかを返します。
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button size="sm" onClick={() => void generate()} disabled={generating}>
              {generating ? "生成中…" : "回答を生成する"}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setShowPrompt((v) => !v)}>
              {showPrompt ? "プロンプトを隠す" : "送信するプロンプトを見る"}
            </Button>
          </div>

          {answer !== null && (
            <div style={{ marginTop: 12 }}>
              {answer.ok ? (
                <>
                  <div style={{ padding: 12, borderRadius: 6, background: "var(--color-bg)", border: "1px solid var(--color-border)", fontSize: 13, lineHeight: 1.9, whiteSpace: "pre-wrap" }}>{answer.text}</div>
                  {answer.meta && (
                    <div style={{ fontSize: 11.5, color: "var(--color-muted)", marginTop: 6 }}>
                      モデル {String(answer.meta.model)} / {String(answer.meta.latencyMs)} ms
                      {answer.meta.usage ? ` / 入力 ${(answer.meta.usage as { inputTokens: number }).inputTokens} + 出力 ${(answer.meta.usage as { outputTokens: number }).outputTokens} トークン` : ""}
                      {answer.meta.costJpy !== undefined ? ` / 約 ${Number(answer.meta.costJpy).toFixed(2)} 円` : ""}
                    </div>
                  )}
                </>
              ) : (
                <Alert variant="warning" title="回答は生成できませんでした">
                  {answer.text}
                  {answer.hint && <div style={{ fontSize: 12, marginTop: 6 }}>{answer.hint}</div>}
                </Alert>
              )}
            </div>
          )}
          {showPrompt && (
            <pre style={{ ...mono, margin: "10px 0 0", padding: 12, borderRadius: 6, background: "var(--color-bg)", border: "1px solid var(--color-border)", maxHeight: 320, overflow: "auto" }}>{prompt}</pre>
          )}
        </div>
      )}

      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>なぜベクトル検索を使っていないか</div>
        <p style={{ fontSize: 12.5, color: "var(--color-muted)", lineHeight: 1.9, margin: 0 }}>
          埋め込み（ベクトル）検索には外部 API と鍵が要ります。鍵を持たない開発者の手元や、オフラインの CI で動かなくなるため、
          まずは <strong>キーワード検索（BM25）</strong>で始めています。社内資料は語彙が限られており、これで実用になります。
          精度が足りなくなったら <code>@platform/rag</code> の <code>VectorIndex</code>（メモリ / pgvector）に差し替えられる形にしてあります。
          <strong>「探す」の実装を変えるだけで、組み立て以降はそのまま使えます。</strong>
        </p>
      </div>
    </main>
  );
}
