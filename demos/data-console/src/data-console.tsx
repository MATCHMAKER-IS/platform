"use client";
/**
 * データ一覧の完成テンプレート(検索 + 外部フィルタ + ソート + ページャ)。
 * @platform/ui の queryRows(検索/ソート/ページの純パイプライン)+ SearchInput + Pagination + EmptyState を束ねる。
 * DataTable の組み込み検索では足りない「状態フィルタ」等を外部で足す構成の見本。
 * @packageDocumentation
 */
import * as React from "react";
import { queryRows, SearchInput, Pagination, EmptyState, Button, type TableQuery } from "@platform/ui";

/** 予約行(サンプル)。 */
export interface BookingRow {
  id: string;
  customer: string;
  cast: string;
  status: "requested" | "confirmed" | "completed" | "cancelled";
  date: string;
  [k: string]: unknown;
}

const STATUS_LABELS: Record<BookingRow["status"] | "all", string> = {
  all: "すべて",
  requested: "申込",
  confirmed: "確定",
  completed: "完了",
  cancelled: "キャンセル",
};

const PAGE_SIZE = 10;

/** {@link DataConsole} の props。 */
export interface DataConsoleProps {
  rows: BookingRow[];
}

/** 検索 + フィルタ + ソート + ページャのデータ一覧テンプレート。 */
export function DataConsole({ rows }: DataConsoleProps) {
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<BookingRow["status"] | "all">("all");
  const [sortKey, setSortKey] = React.useState<string>("date");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");
  const [page, setPage] = React.useState(1);

  // 外部フィルタ(状態)を先に適用
  const filtered = React.useMemo(
    () => (status === "all" ? rows : rows.filter((r) => r.status === status)),
    [rows, status],
  );

  // 検索・ソート・ページングは queryRows(純ロジック)に任せる
  const query: TableQuery = { search, searchKeys: ["customer", "cast"], sortKey, sortDir, page, pageSize: PAGE_SIZE };
  const result = React.useMemo(() => queryRows(filtered, query), [filtered, search, sortKey, sortDir, page]);

  // フィルタ/検索変更時はページを先頭へ
  React.useEffect(() => { setPage(1); }, [search, status]);

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  const columns: { key: keyof BookingRow & string; label: string; sortable?: boolean }[] = [
    { key: "customer", label: "お客様", sortable: true },
    { key: "cast", label: "キャスト", sortable: true },
    { key: "status", label: "状態" },
    { key: "date", label: "日時", sortable: true },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={search} onValueChange={setSearch} placeholder="お客様・キャストで検索" className="w-64" />
        <div className="flex gap-1">
          {(Object.keys(STATUS_LABELS) as (BookingRow["status"] | "all")[]).map((s) => (
            <Button key={s} variant={status === s ? "primary" : "secondary"} size="sm" onClick={() => setStatus(s)}>
              {STATUS_LABELS[s]}
            </Button>
          ))}
        </div>
        <span className="ml-auto text-sm text-[var(--color-muted)]">{result.total} 件</span>
      </div>

      {result.total === 0 ? (
        <EmptyState title="該当する予約がありません" description="検索条件やフィルタを変えてみてください" />
      ) : (
        <>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-muted)]">
                {columns.map((col) => (
                  <th key={col.key} className="px-3 py-2 font-medium">
                    {col.sortable ? (
                      <button type="button" onClick={() => toggleSort(col.key)} className="inline-flex items-center gap-1 hover:text-[var(--color-fg)]">
                        {col.label}
                        {sortKey === col.key && <span aria-hidden="true">{sortDir === "asc" ? "▲" : "▼"}</span>}
                      </button>
                    ) : col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => (
                <tr key={row.id} className="border-b border-[var(--color-border)]">
                  <td className="px-3 py-2">{row.customer}</td>
                  <td className="px-3 py-2">{row.cast}</td>
                  <td className="px-3 py-2">{STATUS_LABELS[row.status]}</td>
                  <td className="px-3 py-2">{row.date}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <Pagination page={result.page} totalPages={result.pageCount} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
