"use client";
/**
 * CSV 取り込みのデモ。行ごと検証 → エラー行の集約 → ドライラン → 適用 → 履歴 → ロールバック。
 *
 * UI は **@platform/ui の部品だけ**で組む(CLAUDE.md「UI 部品は @platform/ui を使う」)。
 */
import * as React from "react";
import {
  ImportHistoryTable,
  ImportHistoryDetail,
  Button,
  Textarea,
  Badge,
  Alert,
  Separator,
  Switch,
  type ImportHistoryRow,
  type SheetColumn,
} from "@platform/ui";
import { validateRows, runImport, type RowResult, type RowValidator, type ValidationReport, type ImportResult } from "@platform/importer";
import { parseCsv, toCsv } from "@platform/csv";

const box: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  background: "var(--color-surface)",
  padding: 16,
  marginBottom: 16,
};

const mono: React.CSSProperties = { fontFamily: "monospace", fontSize: 12 };

/** 取り込む行（CSV から来る生データ）。 */
type Raw = Record<string, string>;

/** 検証を通った行。 */
interface Expense {
  date: string;
  vendor: string;
  category: string;
  amount: number;
}

const CATEGORIES = ["消耗品費", "旅費交通費", "会議費", "図書費", "備品費"];

const SAMPLE_CSV = `日付,支払先,科目,金額
2026-02-01,文具堂,消耗品費,3300
,JR東日本,旅費交通費,1100
2026-02-05,書店,図書費,abc
2026-02-08,カフェABC,交際費,780
2026-02-10,タクシー,旅費交通費,2200`;

const CLEAN_CSV = `日付,支払先,科目,金額
2026-02-01,文具堂,消耗品費,3300
2026-02-08,カフェABC,会議費,780
2026-02-10,タクシー,旅費交通費,2200`;

/**
 * 行バリデータ。**業務のルールはアプリが書く**（基盤は枠組みだけ）。
 * `rowIndex` は 0 始まり（画面には +1 して出す）。
 */
const validate: RowValidator<Raw, Expense> = (raw, rowIndex): RowResult<Expense> => {
  void rowIndex;
  const errors: string[] = [];
  const date = (raw["日付"] ?? "").trim();
  const vendor = (raw["支払先"] ?? "").trim();
  const category = (raw["科目"] ?? "").trim();
  const amountRaw = (raw["金額"] ?? "").trim();
  const amount = Number(amountRaw);

  if (date === "") errors.push("日付が空です");
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push(`日付の形式が違います（${date}）`);
  if (vendor === "") errors.push("支払先が空です");
  if (category === "") errors.push("科目が空です");
  else if (!CATEGORIES.includes(category)) errors.push(`科目「${category}」は登録されていません`);
  if (amountRaw === "") errors.push("金額が空です");
  else if (!Number.isFinite(amount)) errors.push(`金額が数値ではありません（${amountRaw}）`);
  else if (amount <= 0) errors.push("金額が 0 以下です");

  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: { date, vendor, category, amount } };
};

const SAMPLE_HISTORY: ImportHistoryRow[] = [
  { importId: "imp-1004", source: "csv", userId: "u1", importedAt: "2026-02-10T09:12:00Z", total: 3, inserted: 3, errorCount: 0, status: "success" },
  { importId: "imp-1003", source: "paste", userId: "u2", importedAt: "2026-02-09T15:40:00Z", total: 40, inserted: 37, errorCount: 3, status: "partial" },
  { importId: "imp-1002", source: "csv", userId: "u1", importedAt: "2026-02-08T11:05:00Z", total: 10, inserted: 0, errorCount: 10, status: "failed" },
];

const DETAIL: Record<string, Record<string, string>[]> = {
  "imp-1004": [
    { date: "2026-02-01", vendor: "文具堂", category: "消耗品費", amount: "3,300" },
    { date: "2026-02-03", vendor: "JR東日本", category: "旅費交通費", amount: "1,100" },
    { date: "2026-02-05", vendor: "書店", category: "図書費", amount: "2,200" },
  ],
};

const detailCols: SheetColumn<Record<string, string>>[] = [
  { key: "date", header: "日付", width: 110 },
  { key: "vendor", header: "支払先", width: 140 },
  { key: "category", header: "科目", width: 110 },
  { key: "amount", header: "金額", width: 100, align: "right" },
];

export function ImportDemo() {
  const [csv, setCsv] = React.useState(SAMPLE_CSV);
  const [partial, setPartial] = React.useState(false);
  const [dryRun, setDryRun] = React.useState(false);
  const [result, setResult] = React.useState<ImportResult<Raw, Expense> | null>(null);
  const [applied, setApplied] = React.useState<Expense[]>([]);

  const [history, setHistory] = React.useState(SAMPLE_HISTORY);
  const [role, setRole] = React.useState<"approver" | "user">("approver");
  const [selected, setSelected] = React.useState<string | null>(null);

  // ★parseCsv は戻り値が union（header の有無で変わる）
  const rows = React.useMemo(() => {
    try {
      return parseCsv(csv, { header: true }) as Raw[];
    } catch {
      return [];
    }
  }, [csv]);

  const report: ValidationReport<Raw, Expense> = React.useMemo(() => validateRows(rows, validate), [rows]);

  async function doImport() {
    const inserted: Expense[] = [];
    const r = await runImport(rows, validate, {
      dryRun,
      partial,
      apply: async (values) => {
        // 実運用はここが DB のトランザクション
        await new Promise((res) => setTimeout(res, 150));
        inserted.push(...values);
      },
    });
    setResult(r);
    setApplied(inserted);
    if (r.committed) {
      setHistory((h) => [
        {
          importId: `imp-${1005 + h.length - 3}`,
          source: "paste",
          userId: "u1",
          importedAt: new Date().toISOString(),
          total: r.valid.length + r.errors.length,
          inserted: r.applied,
          errorCount: r.errors.length,
          status: r.errors.length === 0 ? "success" : "partial",
        },
        ...h,
      ]);
    }
  }

  const errorCsv = report.errors.length > 0 ? toCsv(report.errors.map((e) => ({ 行: e.rowIndex + 1, ...e.raw, エラー: e.errors.join(" / ") }))) : "";

  return (
    <>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 4 }}>CSV 取り込み</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.8, marginBottom: 20 }}>
        <strong>行ごと検証 → エラーの集約 → ドライラン → 適用 → 履歴 → 取消</strong>。
        マスタ取込の定番処理を <code>@platform/importer</code> が持ちます（<strong>依存ゼロ</strong>）。
        <strong>パースは <code>@platform/csv</code>、業務のルールはアプリ</strong>——役割が分かれています。
      </p>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>① 取り込む CSV</h2>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          <Button size="sm" variant={csv === SAMPLE_CSV ? "primary" : "secondary"} onClick={() => setCsv(SAMPLE_CSV)}>
            エラーを含む（5 行中 3 行）
          </Button>
          <Button size="sm" variant={csv === CLEAN_CSV ? "primary" : "secondary"} onClick={() => setCsv(CLEAN_CSV)}>
            全部正しい
          </Button>
        </div>
        <Textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={6} style={{ ...mono, marginBottom: 10 }} />
        <p style={{ fontSize: 11, color: "var(--color-muted)" }}>
          <code>parseCsv(csv, {"{ header: true }"})</code> で <b>{rows.length}</b> 行を読みました。
          <strong>戻り値が union</strong>（<code>header</code> の有無で <code>string[][]</code> か{" "}
          <code>Record&lt;string,string&gt;[]</code>）なので、呼び出し側で絞ります。
        </p>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>
          ② 検証
          <Badge variant={report.allValid ? "success" : "warning"} style={{ marginLeft: 8 }}>
            全 {report.total} 行中 {report.valid.length} 行が有効
          </Badge>
        </h2>

        {report.errors.length > 0 && (
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse", marginBottom: 10 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--color-muted)" }}>
                <th style={{ padding: 5, width: 50 }}>行</th>
                <th style={{ padding: 5 }}>内容</th>
                <th style={{ padding: 5 }}>なぜダメか</th>
              </tr>
            </thead>
            <tbody>
              {report.errors.map((e) => (
                <tr key={e.rowIndex} style={{ borderTop: "1px solid var(--color-border)" }}>
                  <td style={{ padding: 5, ...mono }}>{e.rowIndex + 1}</td>
                  <td style={{ padding: 5, ...mono, fontSize: 11, color: "var(--color-muted)" }}>{Object.values(e.raw).join(", ")}</td>
                  <td style={{ padding: 5, fontSize: 12, color: "var(--color-danger)" }}>{e.errors.join(" / ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <Alert variant="info" title="エラー行に「なぜダメか」が残ります" style={{ marginBottom: 10 }}>
          <span style={{ fontSize: 12, lineHeight: 1.8 }}>
            <strong>「取り込みに失敗しました」だけでは、現場は直せません。</strong>
            <code>ErrorRow</code> は<strong>行番号・元データ・理由の配列</strong>を持つので、
            <strong>そのまま返せます</strong>。
            <br />
            <strong>1 行に複数の理由</strong>も出ます（4 行目は「科目が登録されていない」）。
            最初の 1 つで止めると、直して再送 → また別のエラー、を繰り返します。
          </span>
        </Alert>

        {errorCsv !== "" && (
          <details>
            <summary style={{ fontSize: 12, color: "var(--color-primary)", cursor: "pointer" }}>エラー行を CSV で返す（現場はこれを直して再送）</summary>
            <pre style={{ ...mono, background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 4, padding: 8, marginTop: 8, whiteSpace: "pre-wrap" }}>
              {errorCsv}
            </pre>
          </details>
        )}
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>③ 適用</h2>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <Switch checked={partial} onCheckedChange={setPartial} />
            <span>
              <code>partial</code> — エラー行があっても有効行だけ入れる
            </span>
          </label>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <Switch checked={dryRun} onCheckedChange={setDryRun} />
            <span>
              <code>dryRun</code> — 検証だけ（DB を触らない）
            </span>
          </label>
          <Button onClick={() => void doImport()}>取り込む</Button>
        </div>

        {result !== null && (
          <>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
              <Badge variant={result.committed ? "success" : "danger"}>{result.committed ? "適用しました" : "適用していません"}</Badge>
              <span style={{ fontSize: 13 }}>
                適用 <b>{result.applied}</b> 件 / 有効 {result.valid.length} / エラー {result.errors.length}
              </span>
              <span style={{ fontSize: 12, color: "var(--color-muted)" }}>
                実際に <code>apply()</code> が受けた行: <b>{applied.length}</b> 件
              </span>
            </div>

            {!result.committed && (
              <Alert variant={dryRun ? "info" : "danger"} title={dryRun ? "ドライランなので適用していません" : "エラー行があるので全体を中止しました"}>
                <span style={{ fontSize: 12, lineHeight: 1.8 }}>
                  {dryRun ? (
                    <>
                      <strong>本番前に必ず通す</strong>ための機能です。<code>apply()</code> は呼ばれないので、
                      <strong>DB を汚さずに全行を検証</strong>できます。
                    </>
                  ) : (
                    <>
                      <strong><code>partial</code> の既定は false です</strong>——
                      <strong>1 行でもエラーなら全体を中止</strong>します（安全側）。
                      <br />
                      「40 行中 37 行だけ入った」状態は、<strong>現場が何を直せばいいか分からなくなります</strong>。
                      <strong>「全件成功か、全件中止か」を業務の要件で選んでください。</strong>
                    </>
                  )}
                </span>
              </Alert>
            )}
          </>
        )}

        <Alert variant="warning" title="partial を ON にして試してください" style={{ marginTop: 10 }}>
          <span style={{ fontSize: 12, lineHeight: 1.8 }}>
            <strong>2 行だけ入り、3 行はエラーとして残ります。</strong>
            <br />
            どちらが正しいかは<strong>業務によります</strong>——
            マスタの一括更新なら「全件中止」、日次の売上取込なら「入るものだけ入れて残りは翌日」。
            <strong>基盤はどちらも選べるようにするだけで、決めるのはアプリ</strong>です。
          </span>
        </Alert>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>④ 履歴と取消</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "var(--color-muted)" }}>操作者:</span>
          <Button size="sm" variant={role === "approver" ? "primary" : "secondary"} onClick={() => setRole("approver")}>
            承認者
          </Button>
          <Button size="sm" variant={role === "user" ? "primary" : "secondary"} onClick={() => setRole("user")}>
            一般
          </Button>
          <Badge variant="secondary">取消は承認者のみ</Badge>
        </div>

        <ImportHistoryTable
          rows={history}
          actorRoles={[role]}
          allowedRoles={["approver"]}
          onRollback={(id) => {
            if (confirm(`${id} を取り消しますか?`)) setHistory((rs) => rs.map((r) => (r.importId === id ? { ...r, status: "rolled_back" } : r)));
          }}
        />

        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
          <strong>「一般」に切り替えると取消ボタンが消えます。</strong>
          取り込みは<strong>大量の行を一度に変える</strong>ので、取消は権限を絞ります。
          <br />
          <strong>誰がいつ取り込んだかを残す</strong>のが要点です——
          「先週の数字が合わない」ときに、<strong>取り込み単位で戻せます</strong>（<code>/audit</code> と組み合わせます）。
        </p>

        <Separator style={{ margin: "14px 0" }} />

        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>明細プレビュー（挿入された行）</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          {history.map((r) => (
            <Button key={r.importId} size="sm" variant="secondary" onClick={() => setSelected(r.importId)}>
              {r.importId}
            </Button>
          ))}
        </div>
        {selected !== null && <ImportHistoryDetail<Record<string, string>> importId={selected} columns={detailCols} rows={DETAIL[selected] ?? []} />}
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>役割分担</h2>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <tbody>
            {[
              { k: "パース", v: "@platform/csv", note: "`parseCsv(text, { header: true })`。**戻り値が union**" },
              { k: "検証の枠組み", v: "@platform/importer", note: "行ごと検証・エラー集約・ドライラン・適用" },
              { k: "**検証のルール**", v: "アプリ", note: "「科目は登録済みのものだけ」は業務判断" },
              { k: "**全件か部分か**", v: "アプリ", note: "`partial` で選ぶ。基盤は決めない" },
              { k: "適用", v: "アプリ", note: "`apply()` の中身は DB のトランザクション" },
            ].map((r) => (
              <tr key={r.k} style={{ borderTop: "1px solid var(--color-border)" }}>
                <td style={{ padding: 5, width: 120 }}>{r.k}</td>
                <td style={{ padding: 5, width: 160, ...mono, fontSize: 11 }}>{r.v}</td>
                <td style={{ padding: 5, fontSize: 11, color: "var(--color-muted)" }}>{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
          <code>@platform/importer</code> は<strong>依存ゼロ</strong>です。
          Excel から取り込むなら <code>@platform/xlsx</code> でパースして、<strong>同じ枠組みに流せます</strong>。
          <br />
          <strong>「取り込み」は毎回同じ形をしています</strong>——検証して、エラーを返して、
          全部入れるか一部だけか決めて、履歴を残す。<strong>各アプリで書くと必ずどれかが抜けます</strong>。
        </p>
      </div>
    </>
  );
}
