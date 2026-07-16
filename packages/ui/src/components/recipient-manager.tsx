"use client";
/**
 * 配信宛先の管理 UI。月次レポート等の送り先を追加・編集・削除する。保存は onSave に委譲。
 * @packageDocumentation
 */
import * as React from "react";
import { Trash2, Plus } from "lucide-react";
import { cn } from "../lib/cn";
import { useT } from "./i18n-provider";
import { upsertRecipient, removeRecipient, isValidEmail, recipientsToRows, recipientsFromRows, type Recipient } from "../lib/recipients";
import { toCsv, parseCsv, downloadCsv } from "@platform/csv";
import { Input } from "./input";
import { Button } from "./button";
import { Badge } from "./badge";

/** {@link RecipientManager} の props。 */
export interface RecipientManagerProps {
  initial?: Recipient[];
  /** 保存時に現在の宛先一覧を返す(repository/fetch で永続化)。 */
  onSave?: (list: Recipient[]) => void;
  className?: string;
}

/** 配信宛先の管理コンポーネント。 */
export function RecipientManager({ initial = [], onSave, className }: RecipientManagerProps) {
  const t = useT();
  const [list, setList] = React.useState<Recipient[]>(initial);
  const [draft, setDraft] = React.useState({ name: "", email: "", role: "" });
  const emailOk = draft.email === "" || isValidEmail(draft.email);

  const add = () => {
    if (!draft.name || !isValidEmail(draft.email)) return;
    setList((l) => upsertRecipient(l, { id: crypto.randomUUID(), name: draft.name, email: draft.email, role: draft.role || undefined, channels: ["email"] }));
    setDraft({ name: "", email: "", role: "" });
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-col gap-2">
        {list.length === 0 && <p className="text-sm text-[var(--color-muted)]">{t("recipient.empty")}</p>}
        {list.map((r) => (
          <div key={r.id} className="flex items-center gap-2 rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-2">
            <div className="flex-1">
              <div className="font-medium">{r.name} {r.role && <Badge variant="secondary">{r.role}</Badge>}</div>
              <div className="text-sm text-[var(--color-muted)]">{r.email}</div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setList((l) => removeRecipient(l, r.id))} aria-label={t("common.delete")}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-2 border-t border-[var(--color-border)] pt-3">
        <Input placeholder={t("recipient.name")} value={draft.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraft((d) => ({ ...d, name: e.target.value }))} className="w-32" />
        <Input placeholder={t("recipient.email")} value={draft.email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraft((d) => ({ ...d, email: e.target.value }))} className={cn("w-56", !emailOk && "border-[var(--color-danger)]")} />
        <Input placeholder={t("recipient.role")} value={draft.role} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraft((d) => ({ ...d, role: e.target.value }))} className="w-32" />
        <Button onClick={add} disabled={!draft.name || !isValidEmail(draft.email)}><Plus className="mr-1 h-4 w-4" />{t("common.add")}</Button>
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => downloadCsv("recipients.csv", recipientsToRows(list))}>{t("recipient.csvExport")}</Button>
          <label className="inline-flex cursor-pointer items-center rounded-[var(--radius)] px-2 py-1 text-sm hover:bg-[var(--color-muted)]/10">
            {t("recipient.csvImport")}
            <input type="file" accept=".csv" className="hidden" onChange={async (e: React.ChangeEvent<HTMLInputElement>) => {
              const file = e.target.files?.[0]; if (!file) return;
              const parsed = parseCsv(await file.text(), { header: true }) as Record<string, string>[];
              setList((l) => { let next = l; for (const r of recipientsFromRows(parsed)) next = upsertRecipient(next, r); return next; });
            }} />
          </label>
          {onSave && <Button variant="secondary" onClick={() => onSave(list)}>{t("common.save")}</Button>}
        </div>
      </div>
    </div>
  );
}
