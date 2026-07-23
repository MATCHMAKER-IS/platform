"use client";
/** 多言語: ドメイン別カタログ結合 + ロケールのサーバ保存(ユーザー別) + 主要コンポーネント翻訳。 */
import { useMemo } from "react";
import { LocaleProvider, useI18n, DataTable, SheetGrid, StatCard, useLocalePreference, createFetchLocaleStore, Button, type DataTableColumn, type SheetColumn } from "@platform/ui";
import { LOCALES, LOCALE_LABELS } from "@platform/i18n";
import { catalogs } from "../../i18n/catalog";

// 擬似サーバ(実運用は /api/locale + UserLocalePref に保存)
const server = { store: {} as Record<string, string> };
const mockFetch = (async (url: string, init?: RequestInit) => {
  const user = new URL(url, "http://x").searchParams.get("user") ?? "anon";
  if (init?.method === "PUT") { server.store[user] = JSON.parse(String(init.body)).locale; return { ok: true } as Response; }
  return { ok: true, json: async () => ({ locale: server.store[user] ?? null }) } as Response;
}) as typeof fetch;

type Row = { id: number; item: string; amount: number };
const ROWS: Row[] = [{ id: 1, item: "A", amount: 1200 }, { id: 2, item: "B", amount: 3400 }, { id: 3, item: "C", amount: 560 }];

const sheetCols = [
  { key: "id", header: "ID", width: 60, align: "right" as const },
  { key: "item", header: "Item", width: 120 },
  { key: "amount", header: "Amount", width: 140, align: "right" as const, format: "currency" as const, currency: "JPY" },
  { key: "date", header: "Date", width: 160, format: "date" as const },
];

function Demo() {
  const i18n = useI18n();
  const columns: DataTableColumn<Row & Record<string, unknown>>[] = [
    { key: "id", header: "ID", sortable: true, align: "right" },
    { key: "item", header: i18n.t("expenses.title"), sortable: true },
    { key: "amount", header: i18n.t("history.col.total"), align: "right", sortable: true, render: (r) => i18n.currency(r.amount) },
  ];
  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <div style={{ fontSize: ".95rem" }}>
        <b>{i18n.t("expenses.title")}</b> — {i18n.t("expenses.monthly")} / {i18n.t("expenses.approve")} / {i18n.t("expenses.reject")}
      </div>
      <div style={{ fontSize: ".95rem" }}>
        <b>{i18n.t("imports.title")}</b> — {i18n.t("imports.history")} / {i18n.t("imports.rollback")}
      </div>
      <div style={{ fontSize: ".85rem", color: "var(--color-muted)" }}>
        {i18n.t("common.search")} / {i18n.t("common.confirm")} / {i18n.t("import.errorsOnly")} / {i18n.t("column.settings")}
      </div>
      <div style={{ display: "flex", gap: ".75rem", flexWrap: "wrap" }}>
        <StatCard label={i18n.t("expenses.title")} value={523400} format="currency" />
        <StatCard label={i18n.t("history.col.total")} value={128} format="number" />
      </div>
      <DataTable rows={ROWS as (Row & Record<string, unknown>)[]} columns={columns} searchKeys={["item"]} pageSize={5} csvFilename="demo.csv" />
      <div style={{ fontSize: ".85rem", color: "var(--color-muted)" }}>SheetGrid の金額・日付も選択言語で整形されます:</div>
      <SheetGrid<Row & { date: string } & Record<string, unknown>>
        rows={ROWS.map((r) => ({ ...r, date: "2026-02-15" })) as (Row & { date: string } & Record<string, unknown>)[]}
        columns={sheetCols as SheetColumn<Row & { date: string } & Record<string, unknown>>[]}
        height={180}
      />
    </div>
  );
}

export function I18nDemo() {
  const store = useMemo(() => createFetchLocaleStore({ endpoint: "/api/locale", userId: "demo-user", fetch: mockFetch }), []);
  const { locale, setLocale } = useLocalePreference(store, "ja");
  return (
    <>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: ".5rem" }}>多言語(ドメイン別辞書 + サーバ保存)</h1>
      <p style={{ color: "var(--color-muted)", fontSize: ".85rem", marginBottom: "1rem" }}>
        言語はユーザー別にサーバ保存(この画面は擬似サーバ)。ドメイン別辞書を <code>namespaced</code> で結合しています。
      </p>
      <div style={{ display: "flex", gap: ".5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        {LOCALES.map((l) => (
          <Button key={l} variant={l === locale ? "primary" : "secondary"} onClick={() => setLocale(l)}>{LOCALE_LABELS[l]}</Button>
        ))}
      </div>
      <LocaleProvider locale={locale} catalogs={catalogs}>
        <Demo />
      </LocaleProvider>
      <p style={{ marginTop: "1.5rem" }}><a href="/">← 戻る</a></p>
    </>
  );
}
