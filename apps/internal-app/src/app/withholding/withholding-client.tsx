"use client";
/** 報酬の源泉徴収・支払調書。支払先ごとの年間集計と、報酬支払の記録（源泉税の自動計算）。 */
import * as React from "react";

interface Report { payee: string; category: string; count: number; totalPayment: number; totalWithholding: number; }
interface PaymentView { payee: string; category: string; base: number; paidAt: string; withholding: number; net: number; }
interface Data { year: string; report: Report[]; payments: PaymentView[]; }

const yen = (n: number) => `¥${n.toLocaleString()}`;
const thisYear = () => String(new Date().getFullYear());
// 源泉税の概算（税抜100万以下 10.21%、超過分 20.42%）
function estWithholding(base: number): number {
  if (base <= 0) return 0;
  const t = base <= 1000000 ? base * 0.1021 : (base - 1000000) * 0.2042 + 1000000 * 0.1021;
  return Math.floor(t);
}

export interface WithholdingClientProps { fetchImpl?: typeof fetch; canWrite?: boolean; }

export function WithholdingClient({ fetchImpl, canWrite = true }: WithholdingClientProps) {
  const [year, setYear] = React.useState(thisYear());
  const [data, setData] = React.useState<Data | null>(null);
  const [form, setForm] = React.useState({ payee: "", category: "デザイン料", base: "", paidAt: "" });
  const [error, setError] = React.useState("");
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;

  const reload = React.useCallback(async () => {
    const res = await doFetch(`/api/withholding?year=${year}`);
    if (res.ok) setData((await res.json()) as Data);
  }, [doFetch, year]);
  React.useEffect(() => { void reload(); }, [reload]);

  const submit = async () => {
    setError("");
    const base = Number(form.base);
    if (!form.payee || !form.category || !(base > 0)) { setError("支払先・区分・正の報酬額(税抜)を入力してください"); return; }
    const res = await doFetch("/api/withholding", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ payee: form.payee, category: form.category, base, paidAt: form.paidAt || undefined }) });
    if (res.ok) { setForm({ payee: "", category: "デザイン料", base: "", paidAt: "" }); await reload(); }
    else setError(((await res.json()) as { error?: string }).error ?? "記録に失敗しました");
  };

  const totalWh = (data?.report ?? []).reduce((s, r) => s + r.totalWithholding, 0);

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">源泉徴収・支払調書</h1>
        <input value={year} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setYear(e.target.value)} inputMode="numeric" className="w-24 rounded border border-neutral-300 px-2 py-1 text-sm" />
      </div>
      <p className="mb-4 text-xs text-neutral-500">個人（士業・デザイナー等）への報酬に源泉徴収税を適用します。年間の支払調書を作成できます。</p>
      {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {canWrite && (
        <div className="mb-6 rounded border border-neutral-200 p-4">
          <h2 className="mb-3 text-sm font-medium">報酬支払を記録</h2>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-neutral-500">支払先<input value={form.payee} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, payee: e.target.value })} className="mt-0.5 block rounded border border-neutral-300 px-2 py-1 text-sm" /></label>
            <label className="text-xs text-neutral-500">区分<input value={form.category} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, category: e.target.value })} className="mt-0.5 block rounded border border-neutral-300 px-2 py-1 text-sm" /></label>
            <label className="text-xs text-neutral-500">報酬(税抜)<input value={form.base} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, base: e.target.value })} inputMode="numeric" className="mt-0.5 block w-28 rounded border border-neutral-300 px-2 py-1 text-sm" /></label>
            <label className="text-xs text-neutral-500">支払日<input type="date" value={form.paidAt} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, paidAt: e.target.value })} className="mt-0.5 block rounded border border-neutral-300 px-2 py-1 text-sm" /></label>
            <button onClick={submit} className="rounded bg-neutral-900 px-4 py-1.5 text-sm text-white">記録</button>
          </div>
          {Number(form.base) > 0 && <p className="mt-2 text-xs text-neutral-500">源泉税（概算）{yen(estWithholding(Number(form.base)))} → 差引支払 {yen(Number(form.base) - estWithholding(Number(form.base)))}</p>}
        </div>
      )}

      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-medium">{year} 年 支払調書</h2>
        <span className="text-xs text-neutral-500">源泉徴収税 合計 {yen(totalWh)}</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
            <th className="px-2 py-1">支払先</th><th className="px-2 py-1">区分</th><th className="px-2 py-1 text-right">件数</th><th className="px-2 py-1 text-right">支払額(税抜)</th><th className="px-2 py-1 text-right">源泉徴収税</th>
          </tr>
        </thead>
        <tbody>
          {(data?.report ?? []).map((r) => (
            <tr key={`${r.payee}:${r.category}`} className="border-b border-neutral-100">
              <td className="px-2 py-2">{r.payee}</td>
              <td className="px-2 py-2 text-xs text-neutral-500">{r.category}</td>
              <td className="px-2 py-2 text-right">{r.count}</td>
              <td className="px-2 py-2 text-right">{yen(r.totalPayment)}</td>
              <td className="px-2 py-2 text-right font-medium">{yen(r.totalWithholding)}</td>
            </tr>
          ))}
          {(data?.report.length ?? 0) === 0 && <tr><td colSpan={5} className="px-2 py-4 text-center text-sm text-neutral-500">この年の報酬支払はありません。</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
