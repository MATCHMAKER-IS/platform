"use client";
/**
 * 一覧テーブル。検索・列ソート・ページング・CSV出力を内蔵。
 * クライアント側で完結(大量データはサーバの repository.paginate と併用)。
 * @packageDocumentation
 */
import * as React from "react";
import { ArrowUpDown } from "lucide-react";
import { cn } from "../lib/cn";
import { queryRows, type TableQuery } from "../lib/table";
import { useI18n } from "./i18n-provider";
import { Highlight } from "./highlight";
import { Input } from "./input";
import { SimplePagination } from "./pagination";
import { CsvExportButton } from "./csv-export-button";

/** 列定義。 */
export interface DataTableColumn<T> {
  key: string;
  header: string;
  sortable?: boolean;
  align?: "left" | "right" | "center";
  render?: (row: T) => React.ReactNode;
  /** ロケール連動の整形(render 未指定時)。 */
  format?: "currency" | "number" | "date";
  /** currency 時の通貨コード(既定 JPY)。 */
  currency?: string;
  /**
   * 横スクロールしても左に貼り付けたままにする。
   *
   * **左端の列（名前・コードなど）を固定すると、右へスクロールしても
   * どの行を見ているか分からなくならない**。
   * 固定するのは 1〜2 列まで。増やすと本文が狭くなる。
   */
  sticky?: boolean;
}

/** {@link DataTable} の props。 */
export interface DataTableProps<T extends Record<string, unknown>> {
  rows: T[];
  columns: DataTableColumn<T>[];
  searchKeys?: string[];
  /** 検索語をセル内でハイライトする(format/render 未指定の列)。 */
  highlightSearch?: boolean;
  pageSize?: number;
  /** CSV 出力ファイル名(指定でエクスポートボタン表示)。 */
  csvFilename?: string;
  /**
   * 固定列の幅(px)。既定 160。
   * 内容が収まらないと隠れるため、**いちばん長い値に合わせる**。
   */
  stickyWidth?: number;
  className?: string;
}

/**
 * 検索・並べ替え・頁送り・CSV 出力が付いた一覧表。
 *
 * **一覧画面はこれで作る。** 自前で `<table>` を組むと、並べ替えの
 * 日本語順や空欄の扱い(`@platform/ui` の `queryRows` が面倒を見ている)を
 * 画面ごとに書き直すことになる。
 *
 * | props | 使いどころ |
 * |---|---|
 * | `searchKeys` | 検索の対象列。**指定しないと検索が効かない** |
 * | `highlightSearch` | 一致部分を強調する。件数が多い一覧で効く |
 * | `pageSize` | 1 頁の件数(既定 20)。行が高いなら小さく |
 * | `csvFilename` | **指定すると CSV 出力ボタンが出る**。無指定なら出ない |
 * | `sticky`（列側） | 横スクロールしても左に貼り付ける。**1〜2 列まで**（増やすと本文が狭い） |
 * | `stickyWidth` | 固定列の幅（既定 160）。内容が収まらないと隠れる |
 *
 * 列の `render` を使うと自由に描けるが、**その列は検索の強調が効かない**
 * (中身を基盤側が知らないため)。
 *
 * @example
 * ```tsx
 * <DataTable
 *   rows={invoices}
 *   columns={[
 *     { key: "code", header: "番号" },
 *     { key: "customer", header: "取引先" },
 *     { key: "amount", header: "金額", format: (v) => `${Number(v).toLocaleString("ja-JP")} 円` },
 *     { key: "status", header: "状態", render: (r) => <Badge variant="success">{r.status}</Badge> },
 *   ]}
 *   searchKeys={["code", "customer"]}
 *   csvFilename="請求一覧.csv"
 * />
 * ```
 */
/**
 * 固定列の見た目を返す。
 *
 * **背景色を必ず付ける**。透明のままだと、下を流れる本文が透けて重なって見える。
 * ヘッダは本文より前面に置く(縦横どちらにスクロールしても隠れないように)。
 *
 * @param col     この列
 * @param columns 全列(左位置の積み上げに使う)
 * @param width   固定列の幅
 * @param isHead  ヘッダか
 * @returns style(固定しない列では空)
 */
function stickyStyle<T>(
  col: DataTableColumn<T>,
  columns: DataTableColumn<T>[],
  width: number,
  isHead: boolean,
): React.CSSProperties {
  if (!col.sticky) return {};
  const before = columns.slice(0, columns.indexOf(col)).filter((c) => c.sticky).length;
  return {
    position: "sticky",
    left: before * width,
    width,
    minWidth: width,
    // 透けると本文と重なって読めなくなる
    background: "var(--color-surface)",
    // ヘッダ(縦にも固定される)を前面に
    zIndex: isHead ? 2 : 1,
    // 固定列の右端に境目を出す。どこまでが固定か分かるように
    boxShadow: "1px 0 0 var(--color-border)",
  };
}

export function DataTable<T extends Record<string, unknown>>({ rows, columns, searchKeys, highlightSearch, pageSize = 10, csvFilename, className , stickyWidth = 160 }: DataTableProps<T>) {
  const [query, setQuery] = React.useState<TableQuery>({ page: 1, pageSize, sortDir: "asc" });
  const i18n = useI18n();
  const t = i18n.t;
  const result = queryRows(rows, { ...query, searchKeys });
  // CSV は現在の検索・ソート結果全件(ページング前)
  const csvRows = queryRows(rows, { ...query, searchKeys, page: 1, pageSize: rows.length || 1 }).rows;

  const toggleSort = (key: string) =>
    setQuery((q) => ({ ...q, sortKey: key, sortDir: q.sortKey === key && q.sortDir === "asc" ? "desc" : "asc", page: 1 }));

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center gap-2">
        {searchKeys?.length ? (
          <Input placeholder={`${t("common.search")}…`} value={query.search ?? ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery((q) => ({ ...q, search: e.target.value, page: 1 }))} className="max-w-xs" />
        ) : null}
        <span className="text-sm text-[var(--color-muted)]">{t("common.count", { count: result.total })}</span>
        {csvFilename && <div className="ml-auto"><CsvExportButton filename={csvFilename} rows={csvRows as Record<string, unknown>[]} columns={columns.map((c) => ({ key: c.key, header: c.header }))}>{t("common.export")}CSV</CsvExportButton></div>}
      </div>

      <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)]">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[var(--color-muted)]/10">
              {columns.map((c) => (
                <th
                  key={c.key}
                  style={stickyStyle(c, columns, stickyWidth, true)}
                  className={cn("px-3 py-2 font-semibold", c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left")}
                >
                  {c.sortable ? (
                    <button type="button" onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1 hover:underline">
                      {c.header}<ArrowUpDown className="h-3 w-3" />
                    </button>
                  ) : c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row, i) => (
              <tr key={i} className="border-t border-[var(--color-border)]">
                {columns.map((c) => (
                  <td
                    key={c.key}
                    style={stickyStyle(c, columns, stickyWidth, false)}
                    className={cn("px-3 py-2", c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left")}
                  >
                    {c.render ? c.render(row) : c.format ? fmtCell(i18n, c, row[c.key]) : (highlightSearch && query.search ? <Highlight text={String(row[c.key] ?? "")} query={query.search} /> : String(row[c.key] ?? ""))}
                  </td>
                ))}
              </tr>
            ))}
            {result.rows.length === 0 && (
              <tr><td colSpan={columns.length} className="px-3 py-6 text-center text-[var(--color-muted)]"></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {result.pageCount > 1 && (
        <SimplePagination page={result.page} totalPages={result.pageCount}
          /* **件数も渡す。** 「3 / 12 ページ」だけでは、
             絞り込みで何件に減ったのかが分からない */
          totalItems={result.total} pageSize={result.pageSize}
          onPageChange={(p: number) => setQuery((q) => ({ ...q, page: p }))} />
      )}
    </div>
  );
}

function fmtCell(i18n: { n(v: number): string; currency(v: number, c?: string): string; date(v: string | number): string }, col: { format?: string; currency?: string }, v: unknown): string {
  if (v == null || v === "") return "";
  if (col.format === "currency") return i18n.currency(Number(v), col.currency ?? "JPY");
  if (col.format === "number") return i18n.n(Number(v));
  if (col.format === "date") return i18n.date(v as string | number);
  return String(v);
}
