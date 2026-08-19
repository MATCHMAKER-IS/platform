"use client";
/** レポート/帳票。期間・取引先で絞り込んで表示/印刷・CSV・Excel 出力。 */
import * as React from "react";
import { Button, Input, PageShell } from "@platform/ui";

const REPORTS = [
  { type: "sales", label: "売上レポート（取引先別）", desc: "取引先ごとの売上・残高", filterable: true },
  { type: "receivables", label: "売掛レポート（未回収）", desc: "未回収の請求一覧と残高", filterable: true },
  { type: "inventory", label: "在庫レポート", desc: "商品別の在庫数・発注要否", filterable: false },
];

export function ReportsClient() {
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [partner, setPartner] = React.useState("");
  const [presets, setPresets] = React.useState<{ id: string; name: string; reportType: string; from?: string; to?: string; partner?: string }[]>([]);
  const [presetName, setPresetName] = React.useState("");
  const doFetch = (globalThis as unknown as { fetch: typeof fetch }).fetch;

  const loadPresets = React.useCallback(async () => { const r = await doFetch("/api/reports/presets"); if (r.ok) setPresets(((await r.json()) as { presets: typeof presets }).presets); }, []);
  React.useEffect(() => { void loadPresets(); }, [loadPresets]);
  const savePreset = async (reportType: string) => {
    if (!presetName) return;
    await doFetch("/api/reports/presets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "add", name: presetName, reportType, ...(from ? { from } : {}), ...(to ? { to } : {}), ...(partner ? { partner } : {}) }) });
    setPresetName("");
    await loadPresets();
  };
  const removePreset = async (id: string) => {
    await doFetch("/api/reports/presets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "remove", id }) });
    await loadPresets();
  };
  const applyPreset = (pr: { from?: string; to?: string; partner?: string }) => { setFrom(pr.from ?? ""); setTo(pr.to ?? ""); setPartner(pr.partner ?? ""); };

  const qs = (type: string, format: string, filterable: boolean) => {
    const params = [`format=${format}`];
    if (filterable) {
      if (from) params.push(`from=${from}`);
      if (to) params.push(`to=${to}`);
      if (partner) params.push(`partner=${encodeURIComponent(partner)}`);
    }
    return `/api/reports/${type}?${params.join("&")}`;
  };

  return (
        <PageShell title="レポート/帳票" width="narrow" description="定型レポートを表示（印刷でPDF化）またはCSV/Excelでダウンロードできます。売上・売掛は期間・取引先で絞り込めます。">
      <div className="mb-4 flex flex-wrap items-end gap-2 rounded border border-[var(--color-border)] p-3">
        <label className="text-xs text-[var(--color-muted)]">発行日 From<Input type="date" value={from} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFrom(e.target.value)} className="mt-0.5 block rounded border border-[var(--color-border)] px-2 py-1 text-sm" /></label>
        <label className="text-xs text-[var(--color-muted)]">To<Input type="date" value={to} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTo(e.target.value)} className="mt-0.5 block rounded border border-[var(--color-border)] px-2 py-1 text-sm" /></label>
        <label className="flex-1 text-xs text-[var(--color-muted)]">取引先（完全一致）<Input value={partner} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPartner(e.target.value)} placeholder="株式会社サンプル" className="mt-0.5 block w-full rounded border border-[var(--color-border)] px-2 py-1 text-sm" /></label>
    {(from || to || partner) && <Button onClick={() => { setFrom(""); setTo(""); setPartner(""); }} variant="secondary" className="rounded px-2 py-1 text-xs">クリア</Button>}
      </div>

      {presets.length > 0 && (
        <div className="mb-4">
          <p className="mb-1 text-xs text-[var(--color-muted)]">保存済みプリセット</p>
          <ul className="flex flex-wrap gap-2">
            {presets.map((pr) => (
              <li key={pr.id} className="flex items-center gap-1 rounded border border-[var(--color-border)] px-2 py-1 text-xs">
        <Button onClick={() => applyPreset(pr)} variant="secondary" className="hover:underline">{pr.name}</Button>
                <Button onClick={() => removePreset(pr.id)} variant="danger" className="hover:text-[var(--color-danger)]" aria-label="削除">×</Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-4 flex items-center gap-2 rounded border border-dashed border-[var(--color-border)] p-2">
        <Input value={presetName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPresetName(e.target.value)} placeholder="現在の条件をプリセット保存（名前）" className="flex-1 rounded border border-[var(--color-border)] px-2 py-1 text-sm" />
        <span className="text-xs text-[var(--color-muted)]">保存先レポート:</span>
    <Button onClick={() => savePreset("sales")} disabled={!presetName} variant="secondary" className="rounded px-2 py-1 text-xs disabled:opacity-50">売上</Button>
    <Button onClick={() => savePreset("receivables")} disabled={!presetName} variant="secondary" className="rounded px-2 py-1 text-xs disabled:opacity-50">売掛</Button>
      </div>

      <ul className="space-y-3">
        {REPORTS.map((r) => (
          <li key={r.type} className="flex items-center justify-between rounded border border-[var(--color-border)] p-4">
            <div><p className="text-sm font-medium">{r.label}</p><p className="text-xs text-[var(--color-muted)]">{r.desc}{r.filterable && (from || to || partner) ? "・絞り込み適用" : ""}</p></div>
            <div className="flex gap-2">
              <a href={qs(r.type, "html", r.filterable)} target="_blank" rel="noreferrer" className="rounded border border-[var(--color-border)] px-3 py-1.5 text-sm">表示/印刷</a>
              <a href={qs(r.type, "csv", r.filterable)} className="rounded border border-[var(--color-border)] px-3 py-1.5 text-sm">CSV</a>
              <a href={qs(r.type, "xlsx", r.filterable)} className="rounded bg-[var(--color-fg)] px-3 py-1.5 text-sm text-white">Excel</a>
            </div>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
