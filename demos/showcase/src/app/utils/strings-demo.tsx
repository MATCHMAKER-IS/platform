"use client";
/** 文字列ユーティリティのデモ: Highlight 検索・wrapText 折り返し・マスク・切り詰め。 */
import { useState } from "react";
import { Highlight, DataTable, LogViewer, List, ListItem, Input, type DataTableColumn } from "@platform/ui";
import { truncateMiddle, maskEmail } from "@platform/utils";

type Row = { id: number; name: string; email: string };
const ROWS: Row[] = [
  { id: 1, name: "田中 太郎", email: "taro.tanaka@example.com" },
  { id: 2, name: "鈴木 花子", email: "hanako.suzuki@example.co.jp" },
  { id: 3, name: "Sato Kenji", email: "kenji@sample.org" },
];

const columns: DataTableColumn<Row & Record<string, unknown>>[] = [
  { key: "id", header: "ID", align: "right", sortable: true },
  { key: "name", header: "氏名", sortable: true },
  { key: "email", header: "メール", render: (r) => maskEmail(r.email) },
];

const LOG = [
  "2026-02-15 09:12:01 INFO  request received GET /api/expenses user=taro",
  "2026-02-15 09:12:01 DEBUG query executed in 12ms rows=37",
  "2026-02-15 09:12:02 WARN  slow response detected for /api/report latency=1840ms",
  "2026-02-15 09:12:03 ERROR failed to fetch exchange rate: timeout after 3000ms",
  "2026-02-15 09:12:03 INFO  retrying exchange rate fetch attempt=2",
  "2026-02-15 09:13:10 INFO  request received POST /api/import user=hanako",
  "2026-02-15 09:13:11 WARN  validation: 3 rows skipped",
  "2026-02-15 09:14:02 ERROR unhandled exception in worker: NPE",
  "2026-02-15 09:14:05 DEBUG gc pause 22ms",
  "2026-02-15 09:15:00 INFO  batch job completed rows=1200",
].join("\n");

const JSON_LOG = [
  '{"level":"info","ts":"2026-02-15T09:12:01Z","msg":"request received","path":"/api/expenses"}',
  '{"level":"debug","ts":"2026-02-15T09:12:01Z","msg":"query executed","rows":37}',
  '{"level":"warn","ts":"2026-02-15T09:12:02Z","msg":"slow response","latency":1840}',
  '{"level":"error","ts":"2026-02-15T09:12:03Z","msg":"exchange rate fetch failed","code":504}',
  '{"level":"info","ts":"2026-02-15T09:13:10Z","msg":"batch completed","rows":1200}',
].join("\n");

export function StringsDemo() {
  const [q, setQ] = useState("た");
  const [text, setText] = useState("これは長い日本語のテキストで、指定した表示幅で自動的に折り返されます。The quick brown fox jumps over the lazy dog.");

  return (
    <>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1rem" }}>文字列ユーティリティ</h1>

      <section style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontWeight: 700, marginBottom: ".5rem" }}>ハイライト + マスク付きテーブル</h2>
        <div style={{ maxWidth: 280, marginBottom: ".5rem" }}>
          <Input placeholder="検索語" value={q} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQ(e.target.value)} />
        </div>
        <p style={{ fontSize: ".9rem", marginBottom: ".5rem" }}>
          プレビュー: {ROWS.map((r) => <span key={r.id} style={{ marginRight: ".75rem" }}><Highlight text={r.name} query={q} /></span>)}
        </p>
        <DataTable rows={ROWS as (Row & Record<string, unknown>)[]} columns={columns} searchKeys={["name", "email"]} highlightSearch pageSize={5} csvFilename="people.csv" />
        <p style={{ fontSize: ".8rem", color: "var(--color-muted)", marginTop: ".25rem" }}>メール列は maskEmail、一致箇所は Highlight で強調。</p>
      </section>

      <section style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontWeight: 700, marginBottom: ".5rem" }}>ログビューア(折り返し + 行番号 + 複数語ハイライト)</h2>
        <Input value={text} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setText(e.target.value)} />
        <div style={{ marginTop: ".5rem" }}>
          <LogViewer text={LOG} wrapWidth={40} highlightQuery={q} colorByLevel showToolbar showTimeline showRelativeTime now={Date.parse("2026-02-15T09:20:00")} downloadFilename="app.log" height={240} />
        </div>
        <p style={{ fontSize: ".8rem", color: "var(--color-muted)", marginTop: ".25rem" }}>レベル色分け・レベル/正規表現フィルタ・時系列ミニチャート・相対時刻・コピー/保存に対応。検索欄の語(空白区切り)は行内で強調されます。</p>
      </section>

      <section style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontWeight: 700, marginBottom: ".5rem" }}>構造化ログ(JSON)+ 時系列ジャンプ + 追尾</h2>
        <LogViewer text={JSON_LOG} structured colorByLevel showToolbar showTimeline showRelativeTime tableFields={["path", "code"]} facetFields={["level", "path"]} now={Date.parse("2026-02-15T09:20:00")} highlightQuery={q} downloadFilename="app.json.log" height={220} />
        <p style={{ fontSize: ".8rem", color: "var(--color-muted)", marginTop: ".25rem" }}>JSON を解析し、フィールドを列表示(path/code)。上部のファセット(level/path)で値ごとに絞り込み、時系列バークリックでジャンプ。</p>
      </section>

      <section style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontWeight: 700, marginBottom: ".5rem" }}>リストのハイライト(ListItem highlightQuery)</h2>
        <List>
          {ROWS.map((r) => <ListItem key={r.id} title={r.name} description={maskEmail(r.email)} highlightQuery={q} />)}
        </List>
      </section>

      <section>
        <h2 style={{ fontWeight: 700, marginBottom: ".5rem" }}>パス切り詰め(truncateMiddle)</h2>
        <p style={{ fontFamily: "monospace", fontSize: ".9rem" }}>{truncateMiddle("/var/log/app/2026/02/15/very-long-file-name.log", 30)}</p>
      </section>

      <p style={{ marginTop: "1.5rem" }}><a href="/">← 戻る</a></p>
    </>
  );
}
