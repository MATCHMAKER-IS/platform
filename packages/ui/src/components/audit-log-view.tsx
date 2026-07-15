"use client";
/**
 * 監査ログ表示。改ざん検証バッジと、操作者・操作・対象・日時の一覧を出す。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn.js";

/** 監査ログの 1 行。 */
export interface AuditLogRow {
  seq: number;
  at: string;
  actor: string;
  action: string;
  target: string;
  description?: string;
}

/** 改ざん検証の結果。 */
export interface AuditVerification {
  valid: boolean;
  brokenAt: number | null;
}

/** {@link AuditLogView} の props。 */
export interface AuditLogViewProps {
  rows: AuditLogRow[];
  verification?: AuditVerification;
  /** 行クリック（詳細表示など）。 */
  onSelect?: (seq: number) => void;
  className?: string;
}

/** 監査ログ表示。 */
export function AuditLogView({ rows, verification, onSelect, className }: AuditLogViewProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {verification && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-[var(--radius)] px-3 py-2 text-sm",
            verification.valid ? "bg-[var(--color-success-bg,#dcfce7)] text-[var(--color-success-fg,#166534)]" : "bg-[var(--color-danger-bg,#fee2e2)] text-[var(--color-danger-fg,#991b1b)]",
          )}
        >
          <span aria-hidden>{verification.valid ? "✓" : "⚠"}</span>
          {verification.valid ? "改ざんなし（ハッシュチェーン検証OK）" : `改ざんの疑い（seq ${verification.brokenAt} 以降）`}
        </div>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-muted)]">
            <th className="px-2 py-1">#</th>
            <th className="px-2 py-1">日時</th>
            <th className="px-2 py-1">操作者</th>
            <th className="px-2 py-1">操作</th>
            <th className="px-2 py-1">対象</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.seq} className={onSelect ? "cursor-pointer border-b border-[var(--color-border)] hover:bg-[var(--color-muted-bg,#f8f8f8)]" : "border-b border-[var(--color-border)]"} onClick={onSelect ? () => onSelect(r.seq) : undefined}>
              <td className="px-2 py-1 text-[var(--color-muted)]">{r.seq}</td>
              <td className="px-2 py-1 whitespace-nowrap">{r.at.slice(0, 19).replace("T", " ")}</td>
              <td className="px-2 py-1">{r.actor}</td>
              <td className="px-2 py-1"><code className="text-xs">{r.action}</code></td>
              <td className="px-2 py-1"><code className="text-xs">{r.target}</code></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
