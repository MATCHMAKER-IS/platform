"use client";
/**
 * 監査ログ画面。検索＋改ざん検証バッジ＋一覧、行クリックで before/after 差分の詳細を表示する。
 * @packageDocumentation
 */
import * as React from "react";
import { AuditEntryDetail, AuditLogView, Button, Input, SearchInput, type AuditLogRow, type AuditVerification, type FieldChangeView } from "@platform/ui";

interface AuditDetail {
  seq: number;
  at: string;
  actor: string;
  action: string;
  target: string;
  description?: string;
  changes: FieldChangeView[];
  related?: { seq: number; at: string; actor: string; action: string; description: string }[];
}

export interface AuditClientProps {
  fetchImpl?: typeof fetch;
}

export function AuditClient({ fetchImpl }: AuditClientProps) {
  const [rows, setRows] = React.useState<AuditLogRow[]>([]);
  const [verification, setVerification] = React.useState<AuditVerification | undefined>(undefined);
  const [actor, setActor] = React.useState("");
  const [action, setAction] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [detail, setDetail] = React.useState<AuditDetail | null>(null);
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;

  React.useEffect(() => {
    let alive = true;
    const timer = setTimeout(async () => {
      const params = new URLSearchParams();
      if (actor.trim()) params.set("actor", actor.trim());
      if (action.trim()) params.set("action", action.trim());
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const qs = params.toString();
      const res = await doFetch(`/api/audit${qs ? `?${qs}` : ""}`);
      if (!alive || !res.ok) return;
      const data = (await res.json()) as { rows: AuditLogRow[]; verification: AuditVerification };
      setRows(data.rows);
      setVerification(data.verification);
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [actor, action, from, to]);

  const exportUrl = (() => {
    const params = new URLSearchParams();
    if (actor.trim()) params.set("actor", actor.trim());
    if (action.trim()) params.set("action", action.trim());
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString();
    return `/api/audit/export${qs ? `?${qs}` : ""}`;
  })();

  const loadDetail = async (seq: number) => {
    const res = await doFetch(`/api/audit/${seq}`);
    if (!res.ok) return;
    setDetail((await res.json()) as AuditDetail);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <SearchInput value={actor} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setActor(e.target.value)} placeholder="操作者で絞り込み" />
        <Input value={action} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAction(e.target.value)} placeholder="操作で絞り込み（例 invoice.create）" className="rounded-[var(--radius)] border border-[var(--color-border)] px-2 py-1.5 text-sm" />
        <label className="text-xs text-[var(--color-muted)]">From<Input type="date" value={from} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFrom(e.target.value)} className="ml-1 rounded-[var(--radius)] border border-[var(--color-border)] px-2 py-1 text-sm" /></label>
        <label className="text-xs text-[var(--color-muted)]">To<Input type="date" value={to} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTo(e.target.value)} className="ml-1 rounded-[var(--radius)] border border-[var(--color-border)] px-2 py-1 text-sm" /></label>
        <a href={exportUrl} className="rounded-[var(--radius)] border border-[var(--color-border)] px-4 py-1.5 text-sm">CSVエクスポート</a>
      </div>
      <AuditLogView rows={rows} verification={verification} onSelect={loadDetail} />
      {detail && (
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium">エントリ詳細</h2>
            <Button className="text-xs text-[var(--color-muted)]" onClick={() => setDetail(null)}>閉じる</Button>
          </div>
          <AuditEntryDetail entry={detail} onJump={loadDetail} />
        </div>
      )}
    </div>
  );
}
