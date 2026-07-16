"use client";
/**
 * 取り込み履歴の詳細。その import で挿入された行をプレビュー表示する。
 * rows を渡すか、fetchRows(importId) で遅延取得できる。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn";
import { useT } from "./i18n-provider";
import { SheetGrid, type SheetColumn } from "./sheet-grid";
import { Badge } from "./badge";

/** {@link ImportHistoryDetail} の props。 */
export interface ImportHistoryDetailProps<T extends Record<string, unknown>> {
  importId: string;
  columns: SheetColumn<T>[];
  /** 事前に用意した挿入行。 */
  rows?: T[];
  /** importId から挿入行を取得(遅延ロード)。 */
  fetchRows?: (importId: string) => Promise<T[]>;
  height?: number;
  className?: string;
}

/** 挿入行プレビュー。 */
export function ImportHistoryDetail<T extends Record<string, unknown>>({ importId, columns, rows, fetchRows, height = 280, className }: ImportHistoryDetailProps<T>) {
  const t = useT();
  const [data, setData] = React.useState<T[] | null>(rows ?? null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (rows) { setData(rows); return; }
    if (!fetchRows) return;
    let active = true;
    setLoading(true);
    void fetchRows(importId).then((r) => { if (active) { setData(r); setLoading(false); } }).catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [importId, rows, fetchRows]);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-2 text-sm">
        <Badge variant="secondary">{importId}</Badge>
        {loading ? <span className="text-[var(--color-muted)]">{t("common.loading")}</span> : <span className="text-[var(--color-muted)]">{t("history.insertedRows", { count: data?.length ?? 0 })}</span>}
      </div>
      {data && data.length > 0 && <SheetGrid<T> rows={data} columns={columns} height={height} resizable />}
    </div>
  );
}
