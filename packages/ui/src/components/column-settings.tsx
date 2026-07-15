"use client";
/**
 * 列の表示/非表示・並べ替え設定。controlled(prefs/onChange)。保存はアプリ側で
 * localStorage / repository に永続化する(createFetchLayoutStore と同様のパターン)。
 * @packageDocumentation
 */
import * as React from "react";
import { ChevronUp, ChevronDown, Eye, EyeOff } from "lucide-react";
import { cn } from "../lib/cn.js";
import { useT } from "./i18n-provider.js";
import { applyColumnPrefs, toggleColumnHidden, moveColumn, type ColumnPrefs } from "../lib/column-prefs.js";
import { Button } from "./button.js";

/** {@link ColumnSettings} の props。 */
export interface ColumnSettingsProps {
  columns: { key: string; label: string }[];
  prefs: ColumnPrefs;
  onChange: (prefs: ColumnPrefs) => void;
  className?: string;
}

/** 列の表示設定 UI(チェックで表示切替、▲▼ で並べ替え)。 */
export function ColumnSettings({ columns, prefs, onChange, className }: ColumnSettingsProps) {
  const t = useT();
  const allKeys = columns.map((c) => c.key);
  // 現在の並び(非表示も含めて order 準拠で表示)
  const ordered = applyColumnPrefs(columns.map((c) => ({ ...c })), { order: prefs.order, hidden: [] });
  const labelOf = (key: string) => columns.find((c) => c.key === key)?.label ?? key;

  return (
    <div className={cn("flex w-64 flex-col gap-1 rounded-[var(--radius)] border border-[var(--color-border)] p-2", className)}>
      {ordered.map((c, i) => {
        const hidden = prefs.hidden.includes(c.key);
        return (
          <div key={c.key} className="flex items-center gap-1 rounded px-1 py-0.5 hover:bg-[var(--color-muted)]/10">
            <Button variant="ghost" size="sm" aria-label={t("column.toggle")} onClick={() => onChange(toggleColumnHidden(prefs, c.key))}>
              {hidden ? <EyeOff className="h-4 w-4 text-[var(--color-muted)]" /> : <Eye className="h-4 w-4" />}
            </Button>
            <span className={cn("flex-1 text-sm", hidden && "text-[var(--color-muted)] line-through")}>{labelOf(c.key)}</span>
            <Button variant="ghost" size="sm" aria-label={t("common.moveUp")} disabled={i === 0} onClick={() => onChange(moveColumn(prefs, c.key, -1, allKeys))}><ChevronUp className="h-4 w-4" /></Button>
            <Button variant="ghost" size="sm" aria-label={t("common.moveDown")} disabled={i === ordered.length - 1} onClick={() => onChange(moveColumn(prefs, c.key, 1, allKeys))}><ChevronDown className="h-4 w-4" /></Button>
          </div>
        );
      })}
    </div>
  );
}
