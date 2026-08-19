"use client";
/**
 * Notion 連携のデモ。**`@platform/notion` の本物のクライアントを動かす**。
 *
 * 実 API には認証情報が要るので、`fetchImpl` に**Notion API の応答を模した関数**を
 * 注入する。クライアント側のロジック（ページ送りの追跡・プロパティの取り出し）は
 * 本物がそのまま動くので、基盤が壊れればこの画面も壊れる。
 *
 * 見せたいのは **`queryDatabase` と `queryAll` の違い**。
 * 前者は 1 回分しか返さないので、件数が増えると**黙って一部だけ処理する**事故になる。
 */
import * as React from "react";
import { Button, Badge, Alert, Input } from "@platform/ui";
import { createNotionClient, type NotionPage } from "@platform/notion";

const box: React.CSSProperties = { border: "1px solid var(--color-border)", borderRadius: "var(--radius)", background: "var(--color-surface)", padding: 16, marginBottom: 16 };

/** 模擬データベースの総件数。**1 ページ 100 件を超える**ように多めにする。 */
const TOTAL = 250;
/** Notion API が 1 回で返す件数。 */
const PAGE_SIZE = 100;

/**
 * Notion API の応答を模した fetch。
 *
 * **`has_more` と `next_cursor` を正しく返す**ことが要点。
 * クライアントはこれを見てページ送りを続けるかどうか判断する。
 */
function createFakeFetch(onCall: (path: string, cursor: string | null) => void): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body !== undefined ? (JSON.parse(String(init.body)) as { start_cursor?: string }) : {};
    const cursor = body.start_cursor ?? null;
    onCall(url.replace("https://api.notion.com/v1", ""), cursor);

    const offset = cursor === null ? 0 : Number(cursor);
    const results = Array.from({ length: Math.min(PAGE_SIZE, TOTAL - offset) }, (_, i) => ({
      id: `page-${offset + i + 1}`,
      url: `https://notion.so/page-${offset + i + 1}`,
      created_time: "2026-07-01T09:00:00.000Z",
      last_edited_time: "2026-08-01T09:00:00.000Z",
      properties: {
        名前: { type: "title", title: [{ plain_text: `議事録 ${offset + i + 1}` }] },
      },
    }));
    const next = offset + results.length;
    return new Response(JSON.stringify({
      results,
      has_more: next < TOTAL,
      next_cursor: next < TOTAL ? String(next) : null,
    }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}

export function NotionDemo() {
  const [databaseId, setDatabaseId] = React.useState("db-meeting-notes");
  const [calls, setCalls] = React.useState<string[]>([]);
  const [pages, setPages] = React.useState<NotionPage[] | null>(null);
  const [mode, setMode] = React.useState<"one" | "all" | null>(null);
  const [busy, setBusy] = React.useState(false);

  const run = async (which: "one" | "all") => {
    setBusy(true); setCalls([]); setPages(null); setMode(which);
    const log: string[] = [];
    // **本物のクライアント。** 差し替えているのは fetch だけ
    const notion = createNotionClient("secret_demo_token", createFakeFetch((path, cursor) => {
      log.push(`POST ${path}${cursor !== null ? `  start_cursor=${cursor}` : "  （1 回目）"}`);
    }));

    const result = which === "one"
      ? (await notion.queryDatabase({ databaseId })).pages
      : await notion.queryAll({ databaseId });

    setCalls(log);
    setPages(result);
    setBusy(false);
  };

  return (
    <>
      <div style={box}>
        <label style={{ fontSize: 12 }}>
          <div style={{ color: "var(--color-muted)", marginBottom: 4 }}>データベース ID（模擬・{TOTAL} 件入っています）</div>
          <Input value={databaseId} onChange={(e) => setDatabaseId(e.target.value)} />
        </label>
        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <Button onClick={() => void run("one")} disabled={busy}>queryDatabase（1 回分）</Button>
          <Button onClick={() => void run("all")} disabled={busy}>queryAll（全件）</Button>
        </div>
      </div>

      {pages && mode !== null && (
        <div style={box}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <Badge variant={pages.length === TOTAL ? "success" : "warning"}>
              {pages.length} 件 / 全 {TOTAL} 件
            </Badge>
            <span style={{ fontSize: 12.5 }}>
              {pages.length === TOTAL
                ? "全件そろっています"
                : "取れていない分があります。件数が増えると集計や同期が静かに壊れます"}
            </span>
          </div>

          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>API の呼び出し</div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
            {calls.map((c) => (
              <li key={c} style={{ fontSize: 11.5, fontFamily: "var(--font-mono)", color: "var(--color-muted)" }}>{c}</li>
            ))}
          </ul>

          <div style={{ fontSize: 13, fontWeight: 700, marginTop: 14, marginBottom: 6 }}>取れたページ（先頭 3 件）</div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
            {pages.slice(0, 3).map((p) => (
              <li key={p.id} style={{ fontSize: 12 }}>
                <code style={{ marginRight: 8 }}>{p.id}</code>{p.title}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Alert variant="info" title="ページ送りは忘れられる">
        Notion API は 1 回で最大 100 件しか返しません。<code>queryDatabase</code> だけを使うと、
        <strong>件数が 100 を超えた日から、黙って一部だけ処理する</strong>ようになります。
        エラーにならないので気づけません。全件が要る場面では <code>queryAll</code> を使ってください。
      </Alert>
    </>
  );
}
