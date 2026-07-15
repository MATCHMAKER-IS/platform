"use client";
/**
 * 監査エントリ詳細。メタ情報と、before/after のフィールド差分を並べて表示する。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn.js";

/** フィールド差分。 */
export interface FieldChangeView {
  field: string;
  before: unknown;
  after: unknown;
}

/** {@link AuditEntryDetail} の props。 */
export interface AuditEntryDetailProps {
  entry: {
    seq: number;
    at: string;
    actor: string;
    action: string;
    target: string;
    description?: string;
    changes: FieldChangeView[];
    related?: { seq: number; at: string; actor: string; action: string; description: string }[];
  };
  /** 関連エントリへのジャンプ。 */
  onJump?: (seq: number) => void;
  className?: string;
}

function render(value: unknown): string {
  if (value === undefined) return "（なし）";
  if (value === null) return "null";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

/** 監査エントリ詳細表示。 */
export function AuditEntryDetail({ entry, onJump, className }: AuditEntryDetailProps) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-[var(--color-muted)]">連番</dt>
        <dd>{entry.seq}</dd>
        <dt className="text-[var(--color-muted)]">日時</dt>
        <dd>{entry.at.slice(0, 19).replace("T", " ")}</dd>
        <dt className="text-[var(--color-muted)]">操作者</dt>
        <dd>{entry.actor}</dd>
        <dt className="text-[var(--color-muted)]">操作</dt>
        <dd><code className="text-xs">{entry.action}</code></dd>
        <dt className="text-[var(--color-muted)]">対象</dt>
        <dd><code className="text-xs">{entry.target}</code></dd>
      </dl>

      <div>
        <h3 className="mb-2 text-sm font-medium">変更内容</h3>
        {entry.changes.length === 0 ? (
          <div className="text-sm text-[var(--color-muted)]">フィールドの変更はありません。</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-muted)]">
                <th className="px-2 py-1">フィールド</th>
                <th className="px-2 py-1">変更前</th>
                <th className="px-2 py-1">変更後</th>
              </tr>
            </thead>
            <tbody>
              {entry.changes.map((c) => (
                <tr key={c.field} className="border-b border-[var(--color-border)] align-top">
                  <td className="px-2 py-1 font-medium">{c.field}</td>
                  <td className="px-2 py-1"><span className="rounded bg-[var(--color-danger-bg,#fee2e2)] px-1 text-[var(--color-danger-fg,#991b1b)]">{render(c.before)}</span></td>
                  <td className="px-2 py-1"><span className="rounded bg-[var(--color-success-bg,#dcfce7)] px-1 text-[var(--color-success-fg,#166534)]">{render(c.after)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {entry.related && entry.related.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium">同じ対象の関連エントリ</h3>
          <ul className="divide-y divide-[var(--color-border)] rounded-[var(--radius)] border border-[var(--color-border)]">
            {entry.related.map((r) => (
              <li key={r.seq}>
                <button
                  className={cn("flex w-full items-center justify-between px-3 py-2 text-left text-sm", onJump ? "hover:bg-[var(--color-muted-bg,#f8f8f8)]" : "cursor-default")}
                  onClick={onJump ? () => onJump(r.seq) : undefined}
                >
                  <span className="min-w-0 truncate">
                    <code className="text-xs">{r.action}</code>
                    <span className="ml-2 text-[var(--color-muted)]">{r.actor}</span>
                  </span>
                  <span className="ml-2 whitespace-nowrap text-xs text-[var(--color-muted)]">#{r.seq} ・ {r.at.slice(0, 16).replace("T", " ")}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
