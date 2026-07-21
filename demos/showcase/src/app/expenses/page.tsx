"use client";
/**
 * 経費精算のデモ。領収書 OCR → 科目推定 → 仕訳 → 一覧・月次レポート。
 *
 * UI は **@platform/ui の部品だけ**で組む(CLAUDE.md「UI 部品は @platform/ui を使う」)。
 */
import * as React from "react";
import { DataTable, Button, Textarea, Badge, Alert, Separator, downloadBlob, type DataTableColumn } from "@platform/ui";
import {
  extractReceiptFields,
  extractReceiptFieldsWithConfidence,
  extractTaxBreakdown,
  normalizeOcrText,
  // parseJapaneseDate は extractReceiptFields が内部で使う(和暦→ISO)
  findRegistrationNumber,
} from "@platform/ocr";
import {
  expenseJournal,
  salesJournal,
  receiptJournal,
  debitTotal,
  creditTotal,
  isBalanced,
  profitAndLoss,
  defaultAccountTypes,
  filterByPeriod,
  journalToRows,
  type JournalEntry,
  type ExpensePayment,
} from "@platform/accounting";
import { monthlyExpenseSummary, renderMonthlyReportHtml } from "@platform/report";
import { writeWorkbook, type Row } from "@platform/xlsx";

const box: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  background: "var(--color-surface)",
  padding: 16,
  marginBottom: 16,
};

const mono: React.CSSProperties = { fontFamily: "monospace", fontSize: 12 };

/** OCR が読んだ領収書の例（実際は `@platform/ocr` の Tesseract / API 経由）。 */
const OCR_SAMPLES = [
  {
    label: "文具（インボイス対応）",
    text: "文具堂 渋谷店\n登録番号 T1234567890123\nTEL 03-1234-5678\n令和8年1月12日\nノート A5 480\nボールペン 220\n10%対象 3,000円\n消費税 300円\n合計 ¥3,300",
  },
  {
    label: "全角で読まれた",
    text: "スーパー○○\n２０２６年１月５日\n合　計　¥８４２\n８％対象　７８０円\n消費税　６２円",
  },
  {
    label: "登録番号なし（免税事業者）",
    text: "個人商店\n2026年1月22日\nコーヒー 780\n合計 ¥780",
  },
];

/** 支払先 → 科目の対応（実運用は学習 or 手で登録）。 */
const VENDOR_ACCOUNT: Record<string, string> = {
  文具堂: "消耗品費",
  "スーパー○○": "消耗品費",
  JR東日本: "旅費交通費",
  タクシー: "旅費交通費",
  個人商店: "会議費",
};

/** 科目 → 区分（`defaultAccountTypes` に無いものを足す）。 */
const EXTRA_TYPES = { 消耗品費: "expense", 会議費: "expense", 図書費: "expense", 備品費: "expense" } as const;

const EXPENSES = [
  { date: "2026-01-05", vendor: "スーパー○○", category: "消耗品費", net: 780, tax: 62, taxRate: 8, status: "承認済", payment: "cash" as ExpensePayment },
  { date: "2026-01-08", vendor: "JR東日本", category: "旅費交通費", net: 1000, tax: 100, taxRate: 10, status: "承認済", payment: "advance" as ExpensePayment },
  { date: "2026-01-12", vendor: "文具堂", category: "消耗品費", net: 3000, tax: 300, taxRate: 10, status: "申請中", payment: "unpaid" as ExpensePayment },
  { date: "2026-01-18", vendor: "○○書店", category: "図書費", net: 5000, tax: 500, taxRate: 10, status: "承認済", payment: "unpaid" as ExpensePayment },
  { date: "2026-01-22", vendor: "カフェABC", category: "会議費", net: 722, tax: 58, taxRate: 8, status: "却下", payment: "cash" as ExpensePayment },
  { date: "2026-01-25", vendor: "タクシー", category: "旅費交通費", net: 2000, tax: 200, taxRate: 10, status: "承認済", payment: "advance" as ExpensePayment },
  { date: "2026-02-02", vendor: "家電量販店", category: "備品費", net: 4000, tax: 400, taxRate: 10, status: "申請中", payment: "unpaid" as ExpensePayment },
];

const PAYMENT_LABEL: Record<ExpensePayment, string> = {
  unpaid: "未払金（後で払う）",
  cash: "現金・カード（その場で払った）",
  advance: "仮払金から精算",
};

const columns: DataTableColumn<(typeof EXPENSES)[number]>[] = [
  { key: "date", header: "日付", sortable: true },
  { key: "vendor", header: "支払先", sortable: true },
  { key: "category", header: "科目", sortable: true },
  { key: "net", header: "税抜", sortable: true, align: "right", render: (r) => `¥${r.net.toLocaleString()}` },
  { key: "tax", header: "消費税", align: "right", render: (r) => `¥${r.tax.toLocaleString()}（${r.taxRate}%）` },
  { key: "status", header: "状態", align: "center" },
];

export default function Page() {
  const [ocrIndex, setOcrIndex] = React.useState(0);
  const [ocrText, setOcrText] = React.useState(OCR_SAMPLES[0]!.text);
  const [payment, setPayment] = React.useState<ExpensePayment>("unpaid");

  // ① OCR のテキストから項目を抽出（全角は正規化してから）
  const normalized = normalizeOcrText(ocrText);
  const fields = extractReceiptFields(normalized);
  const withConf = extractReceiptFieldsWithConfidence({ text: normalized, confidence: 0.82 });
  const breakdown = extractTaxBreakdown(normalized);
  const regNo = findRegistrationNumber(normalized);

  // ② 支払先から科目を推定
  const vendor = ocrText.split("\n")[0]?.replace(/\s.*$/, "") ?? "";
  const guessedAccount = VENDOR_ACCOUNT[vendor] ?? "";

  // ③ 仕訳を作る
  const journal: JournalEntry | null =
    fields.amount !== undefined && breakdown.length > 0
      ? expenseJournal({
          date: fields.date ?? "2026-01-12",
          description: `${vendor} 経費精算`,
          net: breakdown[0]!.subtotal,
          tax: breakdown[0]!.tax ?? 0,
          account: guessedAccount || undefined,
          payment,
        })
      : null;

  // ④ 承認済みの経費をまとめて仕訳 → 損益
  const approved = EXPENSES.filter((e) => e.status === "承認済");
  const entries: JournalEntry[] = React.useMemo(
    () => [
      salesJournal({ date: "2026-01-31", net: 500_000, tax: 50_000 }),
      receiptJournal({ date: "2026-01-31", amount: 300_000 }),
      ...approved.map((e) => expenseJournal({ date: e.date, description: `${e.vendor} ${e.category}`, net: e.net, tax: e.tax, account: e.category, payment: e.payment })),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const types = { ...defaultAccountTypes(), ...EXTRA_TYPES };
  const plDefault = profitAndLoss(entries);
  const plWithExtra = profitAndLoss(entries, types);
  const jan = filterByPeriod(entries, "2026-01");

  const summary = monthlyExpenseSummary(EXPENSES.map((e) => ({ amount: e.net + e.tax, date: e.date, category: e.category })), "2026-01");

  async function exportXlsx() {
    const res = await writeWorkbook([{ name: "仕訳", rows: journalToRows(entries) as unknown as Row[] }]);
    if (!res.ok) return;
    downloadBlob(new Blob([res.value as BlobPart]), "journal-2026-01.xlsx");
  }

  return (
    <main style={{ maxWidth: 900, margin: "2.5rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 4 }}>経費精算</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.8, marginBottom: 20 }}>
        <strong>領収書を撮る → 項目を読む → 科目を推定 → 仕訳にする</strong>。
        ここまでを基盤が担い、<strong>承認のルールだけがアプリの仕事</strong>です。
      </p>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>① 領収書を読む（OCR の結果から抽出）</h2>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {OCR_SAMPLES.map((s, i) => (
            <Button
              key={s.label}
              size="sm"
              variant={ocrIndex === i ? "primary" : "secondary"}
              onClick={() => {
                setOcrIndex(i);
                setOcrText(s.text);
              }}
            >
              {s.label}
            </Button>
          ))}
        </div>
        <Textarea value={ocrText} onChange={(e) => setOcrText(e.target.value)} rows={6} style={{ ...mono, marginBottom: 10 }} />

        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <tbody>
            {[
              { k: "金額", v: fields.amount !== undefined ? `¥${fields.amount.toLocaleString()}` : "—", note: "「合計」を探す" },
              { k: "日付", v: fields.date ?? "—", note: "**和暦も変換**（令和8年 → 2026）" },
              { k: "登録番号", v: regNo ?? "（なし）", note: regNo !== null ? "インボイス対応の事業者" : "**免税事業者。仕入税額控除できない**" },
              { k: "電話番号", v: fields.phone ?? "—", note: "支払先の特定に使う" },
            ].map((r) => (
              <tr key={r.k} style={{ borderTop: "1px solid var(--color-border)" }}>
                <td style={{ padding: 5, width: 90, color: "var(--color-muted)" }}>{r.k}</td>
                <td style={{ padding: 5, ...mono, fontWeight: 700, width: 160 }}>{r.v}</td>
                <td style={{ padding: 5, fontSize: 11, color: "var(--color-muted)" }}>{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {breakdown.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 4 }}>
              <code>extractTaxBreakdown()</code> — 税率ごとの内訳
            </div>
            {breakdown.map((b, i) => (
              <div key={i} style={{ ...mono, fontSize: 12 }}>
                {b.rate}% 対象 ¥{b.subtotal.toLocaleString()} / 消費税 ¥{(b.tax ?? 0).toLocaleString()}
              </div>
            ))}
          </div>
        )}

        <Alert variant="info" title="「全角で読まれた」を押してください" style={{ marginTop: 12 }}>
          <span style={{ fontSize: 12, lineHeight: 1.8 }}>
            <strong>OCR は全角で読むことがあります</strong>（<code>¥３，３００</code>）。
            <code>normalizeOcrText()</code> を通してから抽出するので、<strong>そのまま読めます</strong>。
            <br />
            <strong>「登録番号なし」も押してください。</strong>
            インボイス制度では<strong>登録番号の無い領収書は仕入税額控除できません</strong>——
            読み取った時点で分かれば、<strong>申請前に気づけます</strong>（
            <a href="/tax" style={{ color: "var(--color-primary)" }}>消費税・インボイス</a>のデモも参照）。
            <br />
            <strong>確信度</strong>（<code>extractReceiptFieldsWithConfidence</code>）は{" "}
            <b>{Math.round((withConf.amount?.confidence ?? 0) * 100)}%</b>。
            低い項目だけ人の確認に回す、という運用ができます。
          </span>
        </Alert>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>② 科目を推定して仕訳にする</h2>

        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
          <span style={{ fontSize: 13 }}>
            支払先 <b>{vendor || "—"}</b> →{" "}
            {guessedAccount !== "" ? <Badge variant="success">{guessedAccount}</Badge> : <Badge variant="warning">推定できない（人が選ぶ）</Badge>}
          </span>
        </div>

        <div style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 6 }}>決済方法（仕訳の貸方が変わります）</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {(Object.keys(PAYMENT_LABEL) as ExpensePayment[]).map((p) => (
            <Button key={p} size="sm" variant={payment === p ? "primary" : "secondary"} onClick={() => setPayment(p)}>
              {PAYMENT_LABEL[p]}
            </Button>
          ))}
        </div>

        {journal !== null ? (
          <>
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--color-muted)" }}>
                  <th style={{ padding: 5 }}>勘定科目</th>
                  <th style={{ padding: 5, textAlign: "right", width: 110 }}>借方</th>
                  <th style={{ padding: 5, textAlign: "right", width: 110 }}>貸方</th>
                </tr>
              </thead>
              <tbody>
                {journal.lines.map((l, i) => (
                  <tr key={i} style={{ borderTop: "1px solid var(--color-border)" }}>
                    <td style={{ padding: 5 }}>{l.account}</td>
                    <td style={{ padding: 5, textAlign: "right", ...mono }}>{l.debit > 0 ? `¥${l.debit.toLocaleString()}` : ""}</td>
                    <td style={{ padding: 5, textAlign: "right", ...mono }}>{l.credit > 0 ? `¥${l.credit.toLocaleString()}` : ""}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: "2px solid var(--color-border)", fontWeight: 700 }}>
                  <td style={{ padding: 5 }}>合計</td>
                  <td style={{ padding: 5, textAlign: "right", ...mono }}>¥{debitTotal(journal).toLocaleString()}</td>
                  <td style={{ padding: 5, textAlign: "right", ...mono }}>¥{creditTotal(journal).toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
            <div style={{ marginTop: 8 }}>
              <Badge variant={isBalanced(journal) ? "success" : "danger"}>{isBalanced(journal) ? "貸借一致" : "★貸借が合っていない"}</Badge>
            </div>
          </>
        ) : (
          <Alert variant="warning" title="仕訳を作れません">
            <span style={{ fontSize: 12 }}>金額または税の内訳が読み取れませんでした。</span>
          </Alert>
        )}

        <Alert variant="info" title="決済方法で貸方が変わります" style={{ marginTop: 12 }}>
          <span style={{ fontSize: 12, lineHeight: 1.8 }}>
            <strong>未払金 → 現金預金 → 仮払金</strong>と切り替えてみてください。
            <strong>「立て替えて後で精算」と「仮払金から使った」は、会計上まったく別</strong>です。
            <br />
            <strong>この判断を各アプリで書くと、必ず間違えます。</strong>
            <code>expenseJournal()</code> は<strong>常に貸借の一致した仕訳</strong>を返します。
          </span>
        </Alert>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>③ 経費一覧</h2>
        <DataTable rows={EXPENSES} columns={columns} pageSize={5} />
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>④ 月次の損益</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 10 }}>
          {[
            { label: "既定の科目表", pl: plDefault, note: "消耗品費・会議費などが**未登録**" },
            { label: "科目を足した", pl: plWithExtra, note: "`defaultAccountTypes()` に追加" },
          ].map((x) => (
            <div key={x.label} style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius)", padding: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{x.label}</div>
              <div style={{ fontSize: 12, lineHeight: 1.9 }}>
                <div>
                  収益 <b>¥{x.pl.revenue.toLocaleString()}</b>
                </div>
                <div>
                  費用 <b style={{ color: x.pl.expense === 0 ? "var(--color-danger)" : undefined }}>¥{x.pl.expense.toLocaleString()}</b>
                </div>
                <div style={{ borderTop: "1px solid var(--color-border)", marginTop: 4, paddingTop: 4 }}>
                  純利益 <b>¥{x.pl.netIncome.toLocaleString()}</b>
                </div>
              </div>
              <div style={{ fontSize: 10, color: "var(--color-muted)", marginTop: 6 }}>{x.note}</div>
            </div>
          ))}
        </div>

        <Alert variant="danger" title="未登録の科目は集計されません" style={{ marginTop: 10 }}>
          <span style={{ fontSize: 12, lineHeight: 1.8 }}>
            <strong>左は費用が ¥{plDefault.expense.toLocaleString()} です。</strong>
            <code>defaultAccountTypes()</code> に「消耗品費」「会議費」が入っていないためで、
            <strong>勝手に費用扱いしません</strong>（安全側の設計）。
            <br />
            <strong>知らない科目を「たぶん費用」で集計すると、決算が狂います。</strong>
            自社の科目は <code>{"{ ...defaultAccountTypes(), 消耗品費: \"expense\" }"}</code> で明示的に足してください——
            <strong>「集計されていない」の方が「間違って集計される」より安全</strong>です。
          </span>
        </Alert>

        <Separator style={{ margin: "14px 0" }} />

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Button size="sm" onClick={() => void exportXlsx()}>
            仕訳を Excel に出す
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              const html = renderMonthlyReportHtml(summary);
              const w = window.open("", "_blank");
              w?.document.write(html);
            }}
          >
            月次レポートを開く
          </Button>
          <span style={{ fontSize: 12, color: "var(--color-muted)" }}>
            2026-01 の仕訳 <b>{jan.length}</b> 件（<code>filterByPeriod(entries, &quot;2026-01&quot;)</code>）
          </span>
        </div>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>基盤が持つもの / 持たないもの</h2>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <tbody>
            {[
              { k: "領収書の読み取り", v: "@platform/ocr", note: "金額・日付（**和暦も**）・登録番号・税の内訳" },
              { k: "仕訳の生成", v: "@platform/accounting", note: "**常に貸借一致**。決済方法で貸方が変わる" },
              { k: "試算表・損益", v: "@platform/accounting", note: "**未登録の科目は集計しない**（安全側）" },
              { k: "帳票", v: "@platform/report", note: "月次レポートの HTML" },
              { k: "**承認のルール**", v: "アプリ", note: "「1 万円以上は部長承認」は業務判断" },
              { k: "**科目の対応表**", v: "アプリ", note: "会社ごとに違う" },
            ].map((r) => (
              <tr key={r.k} style={{ borderTop: "1px solid var(--color-border)" }}>
                <td style={{ padding: 5, width: 130 }}>{r.k}</td>
                <td style={{ padding: 5, width: 150, ...mono, fontSize: 11 }}>{r.v}</td>
                <td style={{ padding: 5, fontSize: 11, color: "var(--color-muted)" }}>{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
          <strong>OCR の精度には限界があります。</strong>
          手書きの領収書、印字のかすれ、レシートの折れ——<strong>確信度が低い項目は人が確認する</strong>のが前提です。
          <code>extractReceiptFieldsWithConfidence()</code> があるのはそのためで、
          <strong>「全部自動」を謳うと現場が破綻します</strong>。
        </p>
      </div>
    </main>
  );
}
