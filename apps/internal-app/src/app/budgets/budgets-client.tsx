"use client";
/** 予算実績。区分ごとの予算 vs 実績（経費）と差異・消化率。予算行の追加。 */
import * as React from "react";
import { formatPercent } from "@platform/utils";
import { formatYen } from "@platform/report";
import { formatMonthJst } from "@platform/datetime";
import { Button, Input, PageShell } from "@platform/ui";

interface Row { category: string; period: string; budget: number; actual: number; variance: number; rate: number | null; }
interface Data { period: string; rows: Row[]; }

const yen = (n: number) => formatYen(n);
const thisMonth = () => formatMonthJst();

export interface BudgetsClientProps { fetchImpl?: typeof fetch; canWrite?: boolean; }

export function BudgetsClient({ fetchImpl, canWrite = true }: BudgetsClientProps) {
  const [period, setPeriod] = React.useState(thisMonth());
  const [data, setData] = React.useState<Data | null>(null);
  const [form, setForm] = React.useState({ department: "", category: "", amount: "" });
  const [error, setError] = React.useState("");
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;

  const reload = React.useCallback(async () => {
    const res = await doFetch(`/api/budgets?period=${period}`);
    if (res.ok) setData((await res.json()) as Data);
  }, [doFetch, period]);
  React.useEffect(() => { void reload(); }, [reload]);

  const add = async () => {
    setError("");
    if (!form.department || !form.category || !(Number(form.amount) > 0)) { setError("部門・区分・正の金額を入力してください"); return; }
    const res = await doFetch("/api/budgets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ department: form.department, category: form.category, period, amount: Number(form.amount) }) });
    if (res.ok) { setForm({ department: "", category: "", amount: "" }); await reload(); }
    else setError(((await res.json()) as { error?: string }).error ?? "追加に失敗しました");
  };

  const totalBudget = (data?.rows ?? []).reduce((s, r) => s + r.budget, 0);
  const totalActual = (data?.rows ?? []).reduce((s, r) => s + r.actual, 0);

  return (
    <PageShell title="予算実績">
        <Input type="month" value={period} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPeriod(e.target.value)} className="rounded border border-[var(--color-border)] px-2 py-1 text-sm" />
      <p className="mb-4 text-xs text-[var(--color-muted)]">区分ごとの予算と、経費の実績を突き合わせた差異です。</p>
      {error && <p className="mb-3 rounded bg-[color-mix(in_srgb,var(--color-danger)_8%,transparent)] px-3 py-2 text-sm text-[var(--color-danger)]">{error}</p>}

      {canWrite && (
        <div className="mb-6 rounded border border-[var(--color-border)] p-4">
          <h2 className="mb-3 text-sm font-medium">予算を追加（{period}）</h2>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-[var(--color-muted)]">部門<Input value={form.department} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, department: e.target.value })} className="mt-0.5 block rounded border border-[var(--color-border)] px-2 py-1 text-sm" /></label>
            <label className="text-xs text-[var(--color-muted)]">区分<Input value={form.category} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, category: e.target.value })} placeholder="旅費交通費" className="mt-0.5 block rounded border border-[var(--color-border)] px-2 py-1 text-sm" /></label>
            <label className="text-xs text-[var(--color-muted)]">予算額<Input value={form.amount} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, amount: e.target.value })} inputMode="numeric" className="mt-0.5 block w-28 rounded border border-[var(--color-border)] px-2 py-1 text-sm" /></label>
      <Button onClick={add} className="rounded px-4 py-1.5 text-sm text-white">追加</Button>
          </div>
        </div>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-muted)]">
            <th className="px-2 py-1">区分</th><th className="px-2 py-1 text-right">予算</th><th className="px-2 py-1 text-right">実績</th><th className="px-2 py-1 text-right">差異</th><th className="px-2 py-1 text-right">消化率</th>
          </tr>
        </thead>
        <tbody>
          {(data?.rows ?? []).map((r) => (
            <tr key={r.category} className="border-b border-[var(--color-border)]">
              <td className="px-2 py-2">{r.category}</td>
              <td className="px-2 py-2 text-right">{yen(r.budget)}</td>
              <td className="px-2 py-2 text-right">{yen(r.actual)}</td>
              <td className={`px-2 py-2 text-right font-medium ${r.variance < 0 ? "text-[var(--color-danger)]" : "text-[var(--color-success)]"}`}>{r.variance < 0 ? "" : "+"}{yen(r.variance)}</td>
              <td className="px-2 py-2 text-right text-xs">{r.rate === null ? "—" : `${formatPercent(r.rate)}`}</td>
            </tr>
          ))}
          {(data?.rows.length ?? 0) === 0 && <tr><td colSpan={5} className="px-2 py-4 text-center text-sm text-[var(--color-muted)]">この月の予算・実績はありません。</td></tr>}
          {(data?.rows.length ?? 0) > 0 && <tr className="border-t-2 border-[var(--color-border)] font-medium"><td className="px-2 py-2">合計</td><td className="px-2 py-2 text-right">{yen(totalBudget)}</td><td className="px-2 py-2 text-right">{yen(totalActual)}</td><td className={`px-2 py-2 text-right ${totalBudget - totalActual < 0 ? "text-[var(--color-danger)]" : "text-[var(--color-success)]"}`}>{totalBudget - totalActual < 0 ? "" : "+"}{yen(totalBudget - totalActual)}</td><td></td></tr>}
        </tbody>
      </table>
    </PageShell>
  );
}
