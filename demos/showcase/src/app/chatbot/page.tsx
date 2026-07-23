"use client";
/**
 * 社内チャットボット（会話 + RAG）。
 *
 * /assistant は 1 問 1 答で RAG の流れを見せるもの。こちらは**会話として使う**もので、
 * 実際に社内へ置くならこの形になる。
 *
 * 作りの要点:
 *   - 画面は @platform/ui の ChatWindow（自前のチャット UI を作らない）
 *   - 毎回の発言で資料を検索し、その回の文脈だけを渡す（会話が長くても入力が膨らまない）
 *   - 履歴は直近だけをサーバへ送る（費用と応答時間が際限なく伸びないように）
 *   - **鍵が無くても使える**: 生成できないときは、見つけた資料の抜粋をそのまま返す
 *     （「AI が無いと何も出ない」状態にしない）
 */
import * as React from "react";
import { createBm25Index } from "@platform/search";
import { buildContext, textToDocument, chunkDocument, boostExactKeyword } from "@platform/rag";
import { ChatWindow, Badge, Button, Alert, type MessageGroup } from "@platform/ui";

type Entry = { f: string; h: string; b: string; t: string; x: boolean; p?: string };
type Index = { generatedAt: string; count: number; entries: Entry[] };
type Turn = { id: string; role: "user" | "assistant"; text: string; sources?: string[]; at: string };

const KEY = "demo-chatbot-turns";
const GREETING = "社内の手順書・規約・設計判断から探して答えます。例:「バックアップの復元手順は？」「なぜ db push なの？」";

const today = () => new Date().toISOString().slice(0, 10);
const hhmm = () => new Date().toTimeString().slice(0, 5);

export default function Page() {
  const [index, setIndex] = React.useState<Index | null>(null);
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [aiAvailable, setAiAvailable] = React.useState<boolean | null>(null);
  const [note, setNote] = React.useState("");
  const bm25 = React.useRef<ReturnType<typeof createBm25Index> | null>(null);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setTurns(JSON.parse(raw) as Turn[]);
    } catch { /* noop */ }
    let alive = true;
    void (async () => {
      try {
        const res = await fetch("/docs-index.json");
        const data = (await res.json()) as Index;
        if (!alive) return;
        const idx = createBm25Index({ fieldBoosts: { pkg: 8, heading: 3, breadcrumb: 2, file: 2, body: 1 } });
        idx.addAll(data.entries.map((e, i) => ({ id: String(i), pkg: e.p ?? "", heading: e.h, breadcrumb: e.b, file: e.f, body: e.t })));
        bm25.current = idx;
        setIndex(data);
      } catch {
        if (alive) setNote("資料の索引を読み込めませんでした（node tools/gen-docs-index.mts で生成できます）");
      }
    })();
    return () => { alive = false; };
  }, []);

  const save = (next: Turn[]) => {
    setTurns(next);
    try { localStorage.setItem(KEY, JSON.stringify(next.slice(-40))); } catch { /* noop */ }
  };

  const send = async (text: string) => {
    const q = text.trim();
    if (q === "" || busy) return;
    const userTurn: Turn = { id: `u${Date.now()}`, role: "user", text: q, at: hhmm() };
    const withUser = [...turns, userTurn];
    save(withUser);
    setBusy(true);

    try {
      // 1. その回の質問で資料を検索する（会話が長くなっても入力は膨らまない）
      const idx = bm25.current;
      const pool = idx && index ? idx.search(q, 60).map((h) => ({ e: index.entries[Number(h.id)]!, score: h.score })) : [];
      // 部品名の完全一致を優先（「CSV を出力したい」で @platform/csv が出るように）
      const hits = boostExactKeyword(pool, q, (h) => h.e.p).slice(0, 4).map((h) => ({ e: h.e, s: h.score }));
      const sources = [...new Set(hits.map((h) => h.e.f))];

      if (hits.length === 0) {
        save([...withUser, {
          id: `a${Date.now()}`, role: "assistant", at: hhmm(),
          text: "資料の中に該当する記述が見つかりませんでした。言い回しを変えるか、扱っている範囲（手順書・規約・設計判断）に沿った聞き方を試してください。",
        }]);
        return;
      }

      // 2. 文脈を組み立てる
      const context = buildContext(
        hits.map((h, i) => ({
          chunk: chunkDocument(textToDocument({ id: `s${i}`, title: `${h.e.h}（${h.e.f}）`, text: h.e.t, source: h.e.f }))[0]!,
          score: h.s,
        })),
        { maxChars: 2500 },
      );

      // 3. 生成（鍵が無ければ資料の抜粋で答える）
      const res = await fetch("/api/assistant", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q, context,
          history: withUser.slice(-7, -1).map((t) => ({ role: t.role, content: t.text })),
        }),
      });
      const data = (await res.json()) as { ok: boolean; answer?: string; message?: string; hint?: string; configured?: boolean };
      setAiAvailable(data.ok ? true : data.configured === true ? true : false);

      const fallback =
        `AI の鍵が未設定のため、見つかった資料をそのまま示します。\n\n` +
        hits.map((h, i) => `【${i + 1}】${h.e.h}（${h.e.f}）\n${h.e.t.replace(/\s+/g, " ").slice(0, 220)}…`).join("\n\n");

      save([...withUser, {
        id: `a${Date.now()}`, role: "assistant", at: hhmm(),
        text: data.ok ? (data.answer ?? "") : fallback,
        sources,
      }]);
    } catch {
      save([...withUser, { id: `a${Date.now()}`, role: "assistant", at: hhmm(), text: "エラーが起きました。もう一度試してください。" }]);
    } finally {
      setBusy(false);
    }
  };

  // ChatWindow は日付ごとのグループを受け取る
  const groups: MessageGroup[] = React.useMemo(() => {
    const msgs = turns.length === 0
      ? [{ id: "greet", text: GREETING, authorName: "アシスタント", timestamp: hhmm(), own: false }]
      : turns.map((t) => ({
        id: t.id,
        text: t.sources && t.sources.length > 0 ? `${t.text}\n\n— 参照: ${t.sources.join(" / ")}` : t.text,
        authorName: t.role === "user" ? "あなた" : "アシスタント",
        timestamp: t.at,
        own: t.role === "user",
      }));
    return [{ date: today(), messages: msgs }];
  }, [turns]);

  return (
    <main style={{ maxWidth: 820, margin: "2.5rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 6 }}>社内チャットボット</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 12 }}>
        社内の手順書・規約・設計判断（ADR）を根拠に答えます。会話の流れも踏まえます。
        <strong>鍵が無い環境でも、見つけた資料の抜粋を返す</strong>ので使えなくなりません。
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        {index !== null && <Badge variant="secondary">資料 {index.count} 節</Badge>}
        {aiAvailable === true && <Badge variant="success">AI 生成あり</Badge>}
        {aiAvailable === false && <Badge variant="warning">AI 未設定（資料の抜粋で回答）</Badge>}
        {busy && <Badge variant="secondary">考え中…</Badge>}
        {turns.length > 0 && <Button size="sm" variant="secondary" onClick={() => save([])}>会話を消す</Button>}
      </div>

      {note !== "" && <div style={{ marginBottom: 12 }}><Alert variant="danger">{note}</Alert></div>}

      <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius)", overflow: "hidden", height: 520, display: "flex", flexDirection: "column" }}>
        <ChatWindow
          title="社内アシスタント"
          subtitle={index !== null ? `${index.count} 節の資料から回答` : "資料を読み込み中…"}
          groups={groups}
          onSend={(t) => void send(t)}
          disabled={busy || index === null}
        />
      </div>

      <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius)", background: "var(--color-surface)", padding: 16, marginTop: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>作りの要点</div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.9 }}>
          <li><strong>毎回の発言で資料を引き直す</strong> — 会話が長くなっても、渡す文脈はその回の分だけ。入力トークンが際限なく増えない</li>
          <li><strong>履歴は直近だけ送る</strong> — 全部送ると費用と応答時間が伸び続ける（サーバ側で直近 6 件に制限）</li>
          <li><strong>根拠を必ず示す</strong> — どの資料を見たかを回答に添える。裏取りできない回答は業務では使えない</li>
          <li><strong>鍵が無くても動く</strong> — 生成できないときは資料の抜粋を返す。AI が使えないと何も出ない、という作りにしない</li>
          <li><strong>画面は基盤の部品</strong> — <code>@platform/ui</code> の <code>ChatWindow</code>。自前のチャット UI を作らない</li>
        </ul>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
          1 問 1 答で RAG の内部を見たい場合は <a href="/assistant" style={{ color: "var(--color-primary)" }}>/assistant</a>、
          人同士のチャットは <a href="/chat" style={{ color: "var(--color-primary)" }}>/chat</a> を参照してください。
        </p>
      </div>
    </main>
  );
}
