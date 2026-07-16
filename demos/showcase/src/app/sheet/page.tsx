"use client";
/** SheetGrid(列リサイズ+行仮想化)と 貼り付け取り込み(TSV→行)のデモ。 */
import { useMemo, useState } from "react";
import { SheetGrid, tsvToRows, ImportReview, ColumnSettings, ColumnPresets, useColumnPrefs, createColumnPrefsStore, applyColumnPrefs, validateImportRows, summarizeImport, buildImportHistory, upsertPreset, resolveInitialPrefs, Button, Textarea, Badge, type SheetColumn, type ImportField, type ColumnPreset } from "@platform/ui";

type Row = { id: number; date: string; vendor: string; category: string; amount: number };
const CATS = ["消耗品費", "交通費", "会議費", "図書費", "備品費"];

export default function Page() {
  // 1万行の仮想化デモ
  const rows = useMemo<Row[]>(() => Array.from({ length: 10000 }, (_v, i) => ({
    id: i + 1, date: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`,
    vendor: `取引先${(i % 50) + 1}`, category: CATS[i % CATS.length]!, amount: 500 + (i * 37) % 9000,
  })), []);
  const columns: SheetColumn<Row>[] = [
    { key: "id", header: "ID", width: 70, align: "right" },
    { key: "date", header: "日付", width: 120 },
    { key: "vendor", header: "取引先", width: 140 },
    { key: "category", header: "科目", width: 120 },
    { key: "amount", header: "金額", width: 110, align: "right", render: (r) => `¥${r.amount.toLocaleString()}` },
  ];

  // ユーザー別の列設定をサーバ保存(デモは擬似fetchでメモリ保持)
  const prefsStore = useMemo(() => {
    let mem: any = null;
    const fakeFetch = async (_url: string, init?: any) => (!init || !init.method
      ? { ok: !!mem, json: async () => mem }
      : ((mem = JSON.parse(init.body).prefs), { ok: true })) as any;
    return createColumnPrefsStore({ endpoint: "/api/column-prefs", userId: "demo-user", fetch: fakeFetch as unknown as typeof fetch });
  }, []);
  const initialPresets: ColumnPreset[] = [
    { id: "p1", name: "経理向け(金額優先)", prefs: { order: ["amount", "date", "vendor", "category", "id"], hidden: [] }, shared: true },
    { id: "p0", name: "既定(ID非表示)", prefs: { order: ["date", "vendor", "category", "amount", "id"], hidden: ["id"] }, isDefault: true },
  ];
  const { prefs, setPrefs } = useColumnPrefs(prefsStore, "expenses-sheet", resolveInitialPrefs(null, initialPresets));
  const [showSettings, setShowSettings] = useState(false);
  const [presets, setPresets] = useState<ColumnPreset[]>(initialPresets);
  const visibleColumns = applyColumnPrefs(columns, prefs);

  const [pasted, setPasted] = useState("");
  const [importResult, setImportResult] = useState("");
  const importFields: ImportField[] = [
    { key: "date", label: "日付", type: "date", required: true },
    { key: "vendor", label: "取引先", type: "string", required: true, unique: true },
    { key: "category", label: "科目", type: "string", required: true },
    { key: "amount", label: "金額", type: "number", required: true },
  ] as any;
  const importedRows = useMemo(() => (pasted ? tsvToRows(pasted, ["date", "vendor", "category", "amount"]) : []), [pasted]);

  return (
    <main style={{ maxWidth: 760, margin: "2.5rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>シートグリッド(大量行・リサイズ・貼付)</h1>
      <p style={{ color: "var(--color-muted)", margin: ".5rem 0 1rem", fontSize: ".9rem" }}>
        <Badge variant="secondary">1万行</Badge> 行仮想化で軽快にスクロール。列見出しの右端をドラッグで幅変更。範囲ドラッグ→Ctrl+Cでコピー。
      </p>
      <div style={{ display: "flex", gap: ".5rem", marginBottom: ".5rem" }}>
        <Button variant="secondary" onClick={() => setShowSettings((v) => !v)}>列設定</Button>
      </div>
      <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <SheetGrid<Row> rows={rows} columns={visibleColumns} freezeLeft={1} virtualized rowHeight={32} height={360} />
        </div>
        {showSettings && (
          <div style={{ display: "flex", flexDirection: "column", gap: ".75rem" }}>
            <ColumnSettings
              columns={columns.map((c) => ({ key: c.key, label: String(c.header) }))}
              prefs={prefs}
              onChange={setPrefs}
            />
            <ColumnPresets
              presets={presets}
              current={prefs}
              onApply={setPrefs}
              onSave={(name, shared) => setPresets((ps) => upsertPreset(ps, { id: `p-${Date.now()}`, name, prefs, shared }))}
              onDelete={(id) => setPresets((ps) => ps.filter((p) => p.id !== id))}
            />
          </div>
        )}
      </div>

      <section style={{ marginTop: "2rem" }}>
        <h2 style={{ fontWeight: 700, marginBottom: ".5rem" }}>貼り付け取り込み(Excel からコピー→貼付)</h2>
        <p style={{ color: "var(--color-muted)", fontSize: ".85rem", marginBottom: ".5rem" }}>
          タブ区切り(日付 / 取引先 / 科目 / 金額)を貼り付けると行データに変換します。
        </p>
        <Textarea rows={5} placeholder={"2026-02-01\t文具堂\t消耗品費\t3300\n2026-02-03\tJR東日本\t交通費\t1100"} value={pasted} onChange={(e) => setPasted(e.target.value)} style={{ fontFamily: "monospace" }} />
        {importedRows.length > 0 && (
          <div style={{ marginTop: ".75rem" }}>
            <p style={{ fontSize: ".85rem", color: "var(--color-muted)", marginBottom: ".5rem" }}>
              セルを直接修正できます。「エラー行のみ表示」で絞り込み、すべて解消すると確定できます。
            </p>
            <ImportReview
              rows={importedRows}
              fields={importFields}
              onConfirm={(rows) => {
                const summary = summarizeImport(validateImportRows(rows, importFields));
                const history = buildImportHistory({ source: "paste", userId: "demo-user", importId: "imp-demo" }, summary, rows.length);
                setImportResult(`保存: ${history.inserted}/${history.total} 件(status: ${history.status})`);
              }}
              onPartialConfirm={(rows) => setImportResult(`部分保存: エラー行を除いて ${rows.length} 件を保存`)}
            />
          </div>
        )}
        {importResult && (
          <p style={{ marginTop: ".75rem", padding: ".5rem .75rem", borderRadius: 8, fontSize: ".85rem",
            background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
            {importResult}
          </p>
        )}
      </section>
      <section style={{ marginTop: "2rem" }}>
        <h2 style={{ fontWeight: 700, marginBottom: ".5rem" }}>多列の横仮想化(60列)</h2>
        <p style={{ color: "var(--color-muted)", fontSize: ".85rem", marginBottom: ".5rem" }}>
          列数が非常に多い場合、表示範囲の列だけ描画します。左1列は固定。
        </p>
        <SheetGrid<Record<string, string>>
          rows={Array.from({ length: 200 }, (_v, r) => Object.fromEntries([["row", `R${r + 1}`], ...Array.from({ length: 60 }, (_w, c) => [`c${c}`, `${r + 1}-${c + 1}`])]))}
          columns={[{ key: "row", header: "行", width: 70 }, ...Array.from({ length: 60 }, (_v, c) => ({ key: `c${c}`, header: `列${c + 1}`, width: 90 }))]}
          freezeLeft={1} virtualized virtualizeColumns rowHeight={30} height={320} width={720}
        />
      </section>
      <p style={{ marginTop: "1.5rem" }}><a href="/">← 戻る</a></p>
    </main>
  );
}
