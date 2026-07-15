"use client";
/** 固定資産。台帳（現在簿価つき）、資産登録、償却スケジュール表示。 */
import * as React from "react";

interface Asset { code: string; name: string; acquiredOn: string; cost: number; usefulLifeYears: number; method: string; bookValue: number; currentYearDepreciation: number; accumulated: number; disposed: boolean; disposedOn?: string; disposalType?: string; }
interface Summary { totalCost: number; totalBookValue: number; totalAccumulated: number; count: number; }
interface Data { year: number; assets: Asset[]; summary: Summary; }
interface Row { year: number; depreciation: number; accumulated: number; bookValue: number; }
interface JournalRow { account: string; debit: number; credit: number; memo?: string; }
interface DisposeState { code: string; type: "retire" | "sell"; disposedOn: string; proceeds: string; }

const yen = (n: number) => `¥${n.toLocaleString()}`;
const methodLabel = (m: string) => (m === "declining_balance" ? "定率法" : "定額法");

export interface AssetsClientProps { fetchImpl?: typeof fetch; canWrite?: boolean; }

export function AssetsClient({ fetchImpl, canWrite = true }: AssetsClientProps) {
  const [data, setData] = React.useState<Data | null>(null);
  const [schedule, setSchedule] = React.useState<{ code: string; rows: Row[] } | null>(null);
  const [journal, setJournal] = React.useState<{ rows: JournalRow[]; total: number } | null>(null);
  const [dispose, setDispose] = React.useState<DisposeState | null>(null);
  const [disposeResult, setDisposeResult] = React.useState<{ rows: JournalRow[] } | null>(null);
  const [form, setForm] = React.useState({ code: "", name: "", acquiredOn: "", cost: "", usefulLifeYears: "5", method: "straight_line" });
  const [error, setError] = React.useState("");
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;

  const reload = React.useCallback(async () => {
    const res = await doFetch("/api/assets");
    if (res.ok) setData((await res.json()) as Data);
  }, [doFetch]);
  React.useEffect(() => { void reload(); }, [reload]);

  const register = async () => {
    setError("");
    if (!form.code || !form.name || !form.acquiredOn || !(Number(form.cost) > 0)) { setError("コード・名称・取得日・取得価額を入力してください"); return; }
    const res = await doFetch("/api/assets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: form.code, name: form.name, acquiredOn: form.acquiredOn, cost: Number(form.cost), usefulLifeYears: Number(form.usefulLifeYears), method: form.method }) });
    if (res.ok) { setForm({ code: "", name: "", acquiredOn: "", cost: "", usefulLifeYears: "5", method: "straight_line" }); await reload(); }
    else setError(((await res.json()) as { error?: string }).error ?? "登録に失敗しました");
  };

  const showSchedule = async (code: string) => {
    const res = await doFetch(`/api/assets/${code}/schedule`);
    if (res.ok) { const d = (await res.json()) as { schedule: Row[] }; setSchedule({ code, rows: d.schedule }); }
  };

  const showJournal = async () => {
    const res = await doFetch("/api/assets/journal");
    if (res.ok) { const d = (await res.json()) as { rows: JournalRow[]; total: number }; setJournal({ rows: d.rows, total: d.total }); }
  };

  const submitDispose = async () => {
    if (!dispose) return;
    setError("");
    const payload: { type: string; disposedOn: string; proceeds?: number } = { type: dispose.type, disposedOn: dispose.disposedOn };
    if (dispose.type === "sell") payload.proceeds = Number(dispose.proceeds) || 0;
    const res = await doFetch(`/api/assets/${dispose.code}/dispose`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    if (res.ok) { const d = (await res.json()) as { rows: JournalRow[] }; setDisposeResult({ rows: d.rows }); setDispose(null); await reload(); }
    else setError(((await res.json()) as { error?: string }).error ?? "処分の記録に失敗しました");
  };

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-2xl font-bold">固定資産</h1>
        <button onClick={showJournal} className="rounded border border-neutral-300 px-4 py-2 text-sm">当年の減価償却仕訳</button>
      </div>
      <p className="mb-4 text-xs text-neutral-500">資産台帳と減価償却（定額法・定率法、残存簿価1円まで）です。当年の償却は決算に反映されます。</p>
      {journal && (
        <div className="mb-6 rounded border border-neutral-200 bg-neutral-50 p-4">
          <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-medium">当年の減価償却仕訳（償却費計 {yen(journal.total)}）</h2><button onClick={() => setJournal(null)} className="text-xs text-neutral-500 hover:underline">閉じる</button></div>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-neutral-200 text-left text-xs text-neutral-500"><th className="px-2 py-1">勘定科目</th><th className="px-2 py-1">補助</th><th className="px-2 py-1 text-right">借方</th><th className="px-2 py-1 text-right">貸方</th></tr></thead>
            <tbody>
              {journal.rows.map((r, i) => <tr key={i} className="border-b border-neutral-100"><td className="px-2 py-1.5">{r.account}</td><td className="px-2 py-1.5 text-xs text-neutral-500">{r.memo ?? ""}</td><td className="px-2 py-1.5 text-right">{r.debit ? yen(r.debit) : ""}</td><td className="px-2 py-1.5 text-right">{r.credit ? yen(r.credit) : ""}</td></tr>)}
              {journal.rows.length === 0 && <tr><td colSpan={4} className="px-2 py-3 text-center text-neutral-500">当年の償却はありません。</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {data && (
        <div className="mb-4 grid grid-cols-3 gap-3 text-center text-sm">
          <div className="rounded border border-neutral-200 p-3"><div className="text-xs text-neutral-500">取得価額合計</div><div className="mt-1 font-bold">{yen(data.summary.totalCost)}</div></div>
          <div className="rounded border border-neutral-200 p-3"><div className="text-xs text-neutral-500">簿価合計（{data.year}年）</div><div className="mt-1 font-bold">{yen(data.summary.totalBookValue)}</div></div>
          <div className="rounded border border-neutral-200 p-3"><div className="text-xs text-neutral-500">償却累計</div><div className="mt-1 font-bold">{yen(data.summary.totalAccumulated)}</div></div>
        </div>
      )}

      {canWrite && (
        <div className="mb-6 rounded border border-neutral-200 p-4">
          <h2 className="mb-3 text-sm font-medium">資産を登録</h2>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-neutral-500">コード<input value={form.code} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, code: e.target.value })} className="mt-0.5 block w-24 rounded border border-neutral-300 px-2 py-1 text-sm" /></label>
            <label className="text-xs text-neutral-500">名称<input value={form.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, name: e.target.value })} className="mt-0.5 block rounded border border-neutral-300 px-2 py-1 text-sm" /></label>
            <label className="text-xs text-neutral-500">取得日<input type="date" value={form.acquiredOn} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, acquiredOn: e.target.value })} className="mt-0.5 block rounded border border-neutral-300 px-2 py-1 text-sm" /></label>
            <label className="text-xs text-neutral-500">取得価額<input value={form.cost} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, cost: e.target.value })} inputMode="numeric" className="mt-0.5 block w-28 rounded border border-neutral-300 px-2 py-1 text-sm" /></label>
            <label className="text-xs text-neutral-500">耐用年数<input value={form.usefulLifeYears} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, usefulLifeYears: e.target.value })} inputMode="numeric" className="mt-0.5 block w-16 rounded border border-neutral-300 px-2 py-1 text-sm" /></label>
            <label className="text-xs text-neutral-500">方法<select value={form.method} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm({ ...form, method: e.target.value })} className="mt-0.5 block rounded border border-neutral-300 px-2 py-1 text-sm"><option value="straight_line">定額法</option><option value="declining_balance">定率法</option></select></label>
            <button onClick={register} className="rounded bg-neutral-900 px-4 py-1.5 text-sm text-white">登録</button>
          </div>
        </div>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
            <th className="px-2 py-1">コード</th><th className="px-2 py-1">名称</th><th className="px-2 py-1">取得日</th><th className="px-2 py-1">方法</th><th className="px-2 py-1 text-right">取得価額</th><th className="px-2 py-1 text-right">当年償却</th><th className="px-2 py-1 text-right">簿価</th><th className="px-2 py-1"></th>
          </tr>
        </thead>
        <tbody>
          {(data?.assets ?? []).map((a) => (
            <tr key={a.code} className="border-b border-neutral-100">
              <td className="px-2 py-2 font-mono text-xs">{a.code}</td>
              <td className="px-2 py-2">{a.name}</td>
              <td className="px-2 py-2 text-xs">{a.acquiredOn}</td>
              <td className="px-2 py-2 text-xs">{methodLabel(a.method)}（{a.usefulLifeYears}年）</td>
              <td className="px-2 py-2 text-right">{yen(a.cost)}</td>
              <td className="px-2 py-2 text-right">{yen(a.currentYearDepreciation)}</td>
              <td className={`px-2 py-2 text-right font-medium ${a.disposed ? "text-neutral-400" : ""}`}>{yen(a.bookValue)}</td>
              <td className="px-2 py-2 text-right"><span className="flex justify-end gap-2">{a.disposed ? <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-xs text-neutral-600">処分済（{a.disposalType === "sell" ? "売却" : "除却"}）</span> : (canWrite && <button onClick={() => setDispose({ code: a.code, type: "retire", disposedOn: "", proceeds: "" })} className="text-red-600 hover:underline">除却/売却</button>)}<button onClick={() => showSchedule(a.code)} className="text-blue-600 hover:underline">償却表</button></span></td>
            </tr>
          ))}
          {(data?.assets.length ?? 0) === 0 && <tr><td colSpan={8} className="px-2 py-4 text-center text-sm text-neutral-500">登録された資産はありません。</td></tr>}
        </tbody>
      </table>

      {dispose && (
        <div className="mt-6 rounded border border-red-200 bg-red-50 p-4">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-medium">除却・売却（{dispose.code}）</h2><button onClick={() => setDispose(null)} className="text-xs text-neutral-500 hover:underline">閉じる</button></div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-neutral-500">処分種別<select value={dispose.type} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setDispose({ ...dispose, type: e.target.value as "retire" | "sell" })} className="mt-0.5 block rounded border border-neutral-300 px-2 py-1 text-sm"><option value="retire">除却</option><option value="sell">売却</option></select></label>
            <label className="text-xs text-neutral-500">処分日<input type="date" value={dispose.disposedOn} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDispose({ ...dispose, disposedOn: e.target.value })} className="mt-0.5 block rounded border border-neutral-300 px-2 py-1 text-sm" /></label>
            {dispose.type === "sell" && <label className="text-xs text-neutral-500">売却額<input value={dispose.proceeds} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDispose({ ...dispose, proceeds: e.target.value })} inputMode="numeric" className="mt-0.5 block w-28 rounded border border-neutral-300 px-2 py-1 text-sm" /></label>}
            <button onClick={submitDispose} className="rounded bg-red-700 px-4 py-1.5 text-sm text-white">記録する</button>
          </div>
        </div>
      )}

      {disposeResult && (
        <div className="mt-6 rounded border border-neutral-200 bg-neutral-50 p-4">
          <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-medium">処分の仕訳</h2><button onClick={() => setDisposeResult(null)} className="text-xs text-neutral-500 hover:underline">閉じる</button></div>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-neutral-200 text-left text-xs text-neutral-500"><th className="px-2 py-1">勘定科目</th><th className="px-2 py-1 text-right">借方</th><th className="px-2 py-1 text-right">貸方</th></tr></thead>
            <tbody>{disposeResult.rows.map((r, i) => <tr key={i} className="border-b border-neutral-100"><td className="px-2 py-1.5">{r.account}</td><td className="px-2 py-1.5 text-right">{r.debit ? yen(r.debit) : ""}</td><td className="px-2 py-1.5 text-right">{r.credit ? yen(r.credit) : ""}</td></tr>)}</tbody>
          </table>
        </div>
      )}

      {schedule && (
        <div className="mt-6 rounded border border-neutral-200 p-4">
          <h2 className="mb-2 text-sm font-medium">償却スケジュール（{schedule.code}）</h2>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-neutral-200 text-left text-xs text-neutral-500"><th className="px-2 py-1">年度</th><th className="px-2 py-1 text-right">償却額</th><th className="px-2 py-1 text-right">償却累計</th><th className="px-2 py-1 text-right">期末簿価</th></tr></thead>
            <tbody>
              {schedule.rows.map((r) => (
                <tr key={r.year} className="border-b border-neutral-100"><td className="px-2 py-1.5">{r.year}</td><td className="px-2 py-1.5 text-right">{yen(r.depreciation)}</td><td className="px-2 py-1.5 text-right">{yen(r.accumulated)}</td><td className="px-2 py-1.5 text-right">{yen(r.bookValue)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
