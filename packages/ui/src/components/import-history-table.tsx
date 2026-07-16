"use client";
/**
 * 取り込み履歴の一覧(DataTable)+ ロールバック操作。
 * @packageDocumentation
 */
import { cn } from "../lib/cn";
import { canRollbackWith, type ImportHistoryRow } from "../lib/import-validate";
import { DataTable, type DataTableColumn } from "./data-table";
import { Button } from "./button";
import { Badge } from "./badge";
import { useT } from "./i18n-provider";

/** {@link ImportHistoryTable} の props。 */
export interface ImportHistoryTableProps {
  rows: ImportHistoryRow[];
  /** ロールバック実行(該当 importId の挿入分を取り消す)。 */
  onRollback?: (importId: string) => void;
  /** 操作者のロール。 */
  actorRoles?: string[];
  /** ロールバックを許可するロール(未指定なら誰でも可)。 */
  allowedRoles?: string[];
  className?: string;
}

const STATUS_LABEL: Record<ImportHistoryRow["status"], { text: string; variant: "success" | "warning" | "danger" | "secondary" }> = {
  success: { text: "成功", variant: "success" },
  partial: { text: "一部", variant: "warning" },
  failed: { text: "失敗", variant: "danger" },
  rolled_back: { text: "取消済", variant: "secondary" },
};

/** 取り込み履歴テーブル(検索/ソート/CSV + ロールバック)。 */
export function ImportHistoryTable({ rows, onRollback, actorRoles = [], allowedRoles, className }: ImportHistoryTableProps) {
  const t = useT();
  const columns: DataTableColumn<ImportHistoryRow & Record<string, unknown>>[] = [
    { key: "importedAt", header: t("history.col.datetime"), sortable: true, render: (r) => new Date(r.importedAt).toLocaleString("ja-JP") },
    { key: "source", header: t("history.col.source"), align: "center" },
    { key: "total", header: t("history.col.total"), align: "right", sortable: true },
    { key: "inserted", header: t("history.col.saved"), align: "right" },
    { key: "errorCount", header: t("history.col.errors"), align: "right" },
    { key: "status", header: t("history.col.status"), align: "center", render: (r) => { const st = STATUS_LABEL[r.status]; return <Badge variant={st.variant}>{t(`history.status.${r.status}`)}</Badge>; } },
    {
      key: "_action", header: "", align: "center",
      render: (r) => (onRollback && canRollbackWith(r.status, actorRoles, allowedRoles)
        ? <Button variant="ghost" size="sm" onClick={() => onRollback(r.importId)}>{t("history.rollback")}</Button>
        : <span className="text-[var(--color-muted)]" title={onRollback && !canRollbackWith(r.status, actorRoles, allowedRoles) ? t("history.noPermission") : undefined}>—</span>),
    },
  ];
  return (
    <div className={cn(className)}>
      <DataTable rows={rows as (ImportHistoryRow & Record<string, unknown>)[]} columns={columns} searchKeys={["source", "status"]} pageSize={10} csvFilename="import-history.csv" />
    </div>
  );
}
