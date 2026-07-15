"use client";
/**
 * 列設定プリセットの選択・保存・共有・削除 UI。
 * @packageDocumentation
 */
import * as React from "react";
import { Share2, Trash2, Save } from "lucide-react";
import { cn } from "../lib/cn.js";
import { useT } from "./i18n-provider.js";
import { splitPresets, type ColumnPreset } from "../lib/column-presets.js";
import type { ColumnPrefs } from "../lib/column-prefs.js";
import { Input } from "./input.js";
import { Button } from "./button.js";
import { Badge } from "./badge.js";

/** {@link ColumnPresets} の props。 */
export interface ColumnPresetsProps {
  presets: ColumnPreset[];
  current: ColumnPrefs;
  onApply: (prefs: ColumnPrefs) => void;
  onSave: (name: string, shared: boolean) => void;
  onDelete?: (id: string) => void;
  className?: string;
}

/** プリセット共有 UI。 */
export function ColumnPresets({ presets, current, onApply, onSave, onDelete, className }: ColumnPresetsProps) {
  const t = useT();
  const { shared, personal } = splitPresets(presets);
  const [name, setName] = React.useState("");
  const [share, setShare] = React.useState(false);

  const row = (p: ColumnPreset) => (
    <div key={p.id} className="flex items-center gap-2 rounded px-1 py-0.5 hover:bg-[var(--color-muted)]/10">
      <button type="button" className="flex-1 text-left text-sm hover:underline" onClick={() => onApply(p.prefs)}>{p.name}</button>
      {p.shared && <Badge variant="secondary"><Share2 className="mr-1 h-3 w-3" />{t("column.shared")}</Badge>}
      {onDelete && <Button variant="ghost" size="sm" aria-label={t("common.delete")} onClick={() => onDelete(p.id)}><Trash2 className="h-4 w-4" /></Button>}
    </div>
  );

  return (
    <div className={cn("flex w-72 flex-col gap-2 rounded-[var(--radius)] border border-[var(--color-border)] p-2", className)}>
      {shared.length > 0 && <div><div className="mb-1 text-xs font-semibold text-[var(--color-muted)]">{t("column.sharedPresets")}</div>{shared.map(row)}</div>}
      <div>
        <div className="mb-1 text-xs font-semibold text-[var(--color-muted)]">{t("column.personalPresets")}</div>
        {personal.length === 0 ? <p className="px-1 text-sm text-[var(--color-muted)]">{t("common.none")}</p> : personal.map(row)}
      </div>
      <div className="flex flex-col gap-1 border-t border-[var(--color-border)] pt-2">
        <Input placeholder={t("column.savePresetPlaceholder")} value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} className="h-8" />
        <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={share} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setShare(e.target.checked)} />{t("column.shareAll")}</label>
        <Button size="sm" disabled={!name.trim()} onClick={() => { onSave(name.trim(), share); setName(""); setShare(false); }}>
          <Save className="mr-1 h-4 w-4" />{t("common.save")}
        </Button>
      </div>
    </div>
  );
}
