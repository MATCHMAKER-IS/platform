"use client";
/**
 * FAQ の画面。困っている人が**答えを見つける**ことに集中する。
 *
 * 検索・並べ替え・評価の判定はすべて `@platform/faq` の担当。
 * この画面は表示と、操作を API に渡すことだけを行う。
 */
import * as React from "react";
import { Button, Input } from "@platform/ui";
import type { FaqItem } from "@platform/faq";

interface Hit { item: FaqItem; matched: string; score: number; rate?: number }
interface Category { category: string; items: FaqItem[] }
interface ListData { categories: Category[]; popular: FaqItem[] }

export function FaqClient({ fetchImpl }: { fetchImpl?: typeof fetch }) {
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;
  const [data, setData] = React.useState<ListData | null>(null);
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<Hit[] | null>(null);
  const [opened, setOpened] = React.useState<string | null>(null);
  const [voted, setVoted] = React.useState<Record<string, boolean>>({});
  const [error, setError] = React.useState("");

  const load = React.useCallback(async () => {
    const r = await doFetch("/api/faq");
    const d = (await r.json()) as ListData & { error?: string };
    if (r.ok) setData(d);
    else setError(d.error ?? "取得に失敗しました");
  }, [doFetch]);

  React.useEffect(() => { void load(); }, [load]);

  const search = async (q: string) => {
    setQuery(q);
    if (!q.trim()) { setHits(null); return; }
    const r = await doFetch(`/api/faq?q=${encodeURIComponent(q)}`);
    if (r.ok) setHits(((await r.json()) as { hits: Hit[] }).hits);
  };

  const sendVote = async (id: string, helpful: boolean) => {
    const r = await doFetch("/api/faq", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, helpful }),
    });
    if (r.ok) setVoted((v) => ({ ...v, [id]: true }));
  };

  if (error) return <div style={{ padding: 40, color: "var(--color-danger, #c00)" }}>{error}</div>;

  const card: React.CSSProperties = {
    background: "var(--color-surface, #fff)", border: "1px solid var(--color-border, #e5e7eb)",
    borderRadius: "var(--radius, 10px)", padding: 16, marginBottom: 12,
  };

  /** FAQ 1 件の表示(質問をクリックで回答を開く)。 */
  const renderItem = (item: FaqItem, matched?: string, rate?: number) => {
    const isOpen = opened === item.id;
    return (
      <div key={item.id} style={{ borderTop: "1px solid var(--color-border, #f3f4f6)", padding: "8px 0" }}>
        <Button
          onClick={() => setOpened(isOpen ? null : item.id)}
          style={{
            display: "flex", width: "100%", textAlign: "left", gap: 8, alignItems: "baseline",
            background: "none", border: "none", cursor: "pointer", padding: 0, color: "var(--color-fg, #111)",
          }}
        >
          <span style={{ color: "var(--color-muted, #999)", fontSize: 11 }}>{isOpen ? "▼" : "▶"}</span>
          <span style={{ flex: 1, fontSize: 14 }}>{item.question}</span>
          {matched && <span style={{ fontSize: 10, color: "var(--color-muted, #999)" }}>{matched}で一致</span>}
          {rate !== undefined && (
            <span style={{ fontSize: 10, color: rate >= 0.7 ? "var(--color-success, #16a34a)" : "var(--color-muted, #999)" }}>
              {Math.round(rate * 100)}% 役立った
            </span>
          )}
        </Button>
        {isOpen && (
          <div style={{ marginLeft: 20, marginTop: 8 }}>
            <div style={{ fontSize: 13, lineHeight: 1.8, whiteSpace: "pre-wrap", color: "var(--color-fg, #333)" }}>{item.answer}</div>
            <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
              {voted[item.id] ? (
                <span style={{ fontSize: 12, color: "var(--color-success, #16a34a)" }}>ありがとうございました</span>
              ) : (
                <>
                  <span style={{ fontSize: 12, color: "var(--color-muted, #888)" }}>役に立ちましたか?</span>
                  <Button onClick={() => void sendVote(item.id, true)} style={voteBtn}>はい</Button>
                  <Button onClick={() => void sendVote(item.id, false)} style={voteBtn}>いいえ</Button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 22 }}>FAQ</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted, #666)" }}>
        よくある質問と答えです。見つからない場合は情シスへお問い合わせください。
      </p>

      {/* 検索 */}
      <div style={card}>
        <Input
          value={query}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => void search(e.target.value)}
          placeholder="探したいことを入力(例: 経費 締め切り)"
          style={{
            width: "100%", padding: "10px 12px", fontSize: 14,
            border: "1px solid var(--color-border, #ddd)", borderRadius: "var(--radius, 8px)",
            background: "var(--color-bg, #fff)", color: "var(--color-fg, #111)",
          }}
        />
      </div>

      {/* 検索結果 */}
      {hits !== null && (
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
            検索結果（{hits.length}）
          </div>
          {hits.length === 0 && (
            <p style={{ fontSize: 13, color: "var(--color-muted, #888)" }}>
              見つかりませんでした。別の言い方を試すか、情シスへお問い合わせください。
            </p>
          )}
          {hits.map((h) => renderItem(h.item, h.matched, h.rate))}
        </div>
      )}

      {/* 検索していないときは よく見られる質問 + カテゴリ別 */}
      {hits === null && data && (
        <>
          <div style={card}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>よくある質問</div>
            <p style={{ fontSize: 11, color: "var(--color-muted, #888)", margin: "2px 0 4px" }}>役に立ったと評価が多いもの</p>
            {data.popular.map((i) => renderItem(i))}
          </div>

          {data.categories.map((c) => (
            <div key={c.category} style={card}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>
                {c.category}
                <span style={{ fontWeight: 400, fontSize: 11, color: "var(--color-muted, #999)", marginLeft: 6 }}>{c.items.length} 件</span>
              </div>
              {c.items.map((i) => renderItem(i))}
            </div>
          ))}
        </>
      )}

      {!data && hits === null && <p style={{ fontSize: 13, color: "var(--color-muted, #888)" }}>読み込み中…</p>}
    </div>
  );
}

const voteBtn: React.CSSProperties = {
  padding: "3px 12px", fontSize: 12, cursor: "pointer",
  border: "1px solid var(--color-border, #ddd)", borderRadius: 999,
  background: "var(--color-surface, #fff)", color: "var(--color-fg, #111)",
};
