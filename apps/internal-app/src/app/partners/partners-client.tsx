"use client";
/** 取引先マスタ。得意先・仕入先・報酬支払先を一元管理（1社が複数区分可）。区分で絞込、登録・更新。 */
import * as React from "react";

type Kind = "customer" | "supplier" | "payee";
interface Partner { code: string; name: string; kinds: Kind[]; contact?: string; note?: string; }
interface Activity { invoices: { number: string; issueDate: string; total: number }[]; orders: { number: string; orderDate: string; total: number }[]; feePayments: { category: string; base: number; withholding: number; paidAt: string }[]; totalBilled: number; totalOrdered: number; totalPaid: number; }
interface Balance { code: string; name: string; receivable: number; payable: number; net: number; }
const yen = (n: number) => `¥${n.toLocaleString()}`;

const KIND_LABEL: Record<Kind, string> = { customer: "得意先", supplier: "仕入先", payee: "報酬支払先" };
const ALL_KINDS: Kind[] = ["customer", "supplier", "payee"];

export interface PartnersClientProps { fetchImpl?: typeof fetch; canWrite?: boolean; }

export function PartnersClient({ fetchImpl, canWrite = true }: PartnersClientProps) {
  const [filter, setFilter] = React.useState<"" | Kind>("");
  const [partners, setPartners] = React.useState<Partner[]>([]);
  const [form, setForm] = React.useState<{ code: string; name: string; kinds: Kind[]; contact: string }>({ code: "", name: "", kinds: [], contact: "" });
  const [error, setError] = React.useState("");
  const [activity, setActivity] = React.useState<{ code: string; name: string; data: Activity } | null>(null);
  const [balances, setBalances] = React.useState<{ rows: Balance[]; total: Balance } | null>(null);
  const [importing, setImporting] = React.useState(false);
  const [csvText, setCsvText] = React.useState("");
  const [importMsg, setImportMsg] = React.useState("");
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;

  const reload = React.useCallback(async () => {
    const res = await doFetch(`/api/partners${filter ? `?kind=${filter}` : ""}`);
    if (res.ok) setPartners(((await res.json()) as { partners: Partner[] }).partners);
  }, [doFetch, filter]);
  React.useEffect(() => { void reload(); }, [reload]);

  const toggleKind = (k: Kind) => setForm((f) => ({ ...f, kinds: f.kinds.includes(k) ? f.kinds.filter((x) => x !== k) : [...f.kinds, k] }));

  const save = async () => {
    setError("");
    if (!form.code || !form.name || form.kinds.length === 0) { setError("コード・名称・区分（1つ以上）を入力してください"); return; }
    const res = await doFetch("/api/partners", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: form.code, name: form.name, kinds: form.kinds, contact: form.contact || undefined }) });
    if (res.ok) { setForm({ code: "", name: "", kinds: [], contact: "" }); await reload(); }
    else setError(((await res.json()) as { error?: string }).error ?? "保存に失敗しました");
  };

  const edit = (p: Partner) => setForm({ code: p.code, name: p.name, kinds: p.kinds, contact: p.contact ?? "" });

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result ?? ""));
    reader.readAsText(file);
  };

  const runImport = async () => {
    setImportMsg("");
    if (!csvText.trim()) { setImportMsg("CSV を貼り付けるかファイルを選択してください"); return; }
    const res = await doFetch("/api/partners/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ csv: csvText }) });
    if (res.ok) {
      const d = (await res.json()) as { imported: number; errors: { line: number; message: string }[] };
      setImportMsg(`${d.imported} 件を取り込みました${d.errors.length ? `（エラー ${d.errors.length} 件: ` + d.errors.map((e) => `${e.line}行目 ${e.message}`).join(" / ") + "）" : ""}`);
      setCsvText(""); await reload();
    } else setImportMsg(((await res.json()) as { error?: string }).error ?? "取り込みに失敗しました");
  };

  const showActivity = async (p: Partner) => {
    const res = await doFetch(`/api/partners/${p.code}/activity`);
    if (res.ok) { const d = (await res.json()) as { activity: Activity }; setActivity({ code: p.code, name: p.name, data: d.activity }); }
  };

  const toggleBalances = async () => {
    if (balances) { setBalances(null); return; }
    const res = await doFetch("/api/partners/balances");
    if (res.ok) { const d = (await res.json()) as { balances: Balance[]; total: Balance }; setBalances({ rows: d.balances, total: d.total }); }
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-2xl font-bold">取引先マスタ</h1>
        <span className="flex gap-2">
          <a href="/api/partners/export" className="rounded border border-neutral-300 px-4 py-2 text-sm">CSV書出</a>
          {canWrite && <button onClick={() => setImporting((v) => !v)} className="rounded border border-neutral-300 px-4 py-2 text-sm">{importing ? "取込を閉じる" : "CSV取込"}</button>}
          <button onClick={toggleBalances} className="rounded border border-neutral-300 px-4 py-2 text-sm">{balances ? "残高を閉じる" : "残高一覧"}</button>
        </span>
      </div>
      <p className="mb-4 text-xs text-neutral-500">得意先・仕入先・報酬支払先を一元管理します（1社が複数区分を持てます）。</p>
      {balances && (
        <div className="mb-6 rounded border border-neutral-200 p-4">
          <h2 className="mb-2 text-sm font-medium">取引先残高（売掛・買掛）</h2>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-neutral-200 text-left text-xs text-neutral-500"><th className="px-2 py-1">取引先</th><th className="px-2 py-1 text-right">売掛残</th><th className="px-2 py-1 text-right">買掛残</th><th className="px-2 py-1 text-right">差引</th></tr></thead>
            <tbody>
              {balances.rows.filter((b) => b.receivable !== 0 || b.payable !== 0).map((b) => (
                <tr key={b.code} className="border-b border-neutral-100"><td className="px-2 py-1.5">{b.name}</td><td className="px-2 py-1.5 text-right">{yen(b.receivable)}</td><td className="px-2 py-1.5 text-right">{yen(b.payable)}</td><td className={`px-2 py-1.5 text-right font-medium ${b.net < 0 ? "text-red-600" : ""}`}>{yen(b.net)}</td></tr>
              ))}
              {balances.rows.filter((b) => b.receivable !== 0 || b.payable !== 0).length === 0 && <tr><td colSpan={4} className="px-2 py-3 text-center text-neutral-500">残高のある取引先はありません。</td></tr>}
              <tr className="border-t-2 border-neutral-300 font-medium"><td className="px-2 py-1.5">合計</td><td className="px-2 py-1.5 text-right">{yen(balances.total.receivable)}</td><td className="px-2 py-1.5 text-right">{yen(balances.total.payable)}</td><td className="px-2 py-1.5 text-right">{yen(balances.total.net)}</td></tr>
            </tbody>
          </table>
        </div>
      )}
      {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {importing && (
        <div className="mb-6 rounded border border-neutral-200 p-4">
          <h2 className="mb-2 text-sm font-medium">取引先を CSV で取り込み</h2>
          <p className="mb-2 text-xs text-neutral-500">見出し「コード,名称,区分,連絡先」。区分は customer/supplier/payee をカンマ区切りで。既存コードは上書きされます。</p>
          <input type="file" accept=".csv,text/csv" onChange={onFile} className="mb-2 block text-sm" />
          <textarea value={csvText} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCsvText(e.target.value)} rows={5} placeholder="コード,名称,区分,連絡先&#10;P001,甲商事,&quot;customer,supplier&quot;,03-1234" className="block w-full rounded border border-neutral-300 px-2 py-1 font-mono text-xs" />
          <div className="mt-2 flex items-center gap-3">
            <button onClick={runImport} className="rounded bg-neutral-900 px-4 py-1.5 text-sm text-white">取り込む</button>
            {importMsg && <span className="text-xs text-neutral-600">{importMsg}</span>}
          </div>
        </div>
      )}

      <div className="mb-4 flex gap-1 text-sm">
        <button onClick={() => setFilter("")} className={`rounded px-3 py-1 ${filter === "" ? "bg-neutral-900 text-white" : "border border-neutral-300"}`}>すべて</button>
        {ALL_KINDS.map((k) => <button key={k} onClick={() => setFilter(k)} className={`rounded px-3 py-1 ${filter === k ? "bg-neutral-900 text-white" : "border border-neutral-300"}`}>{KIND_LABEL[k]}</button>)}
      </div>

      {canWrite && (
        <div className="mb-6 rounded border border-neutral-200 p-4">
          <h2 className="mb-3 text-sm font-medium">取引先を登録・更新</h2>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-neutral-500">コード<input value={form.code} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, code: e.target.value })} className="mt-0.5 block w-24 rounded border border-neutral-300 px-2 py-1 text-sm" /></label>
            <label className="text-xs text-neutral-500">名称<input value={form.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, name: e.target.value })} className="mt-0.5 block rounded border border-neutral-300 px-2 py-1 text-sm" /></label>
            <label className="text-xs text-neutral-500">連絡先<input value={form.contact} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, contact: e.target.value })} className="mt-0.5 block rounded border border-neutral-300 px-2 py-1 text-sm" /></label>
          </div>
          <div className="mt-2 flex gap-3 text-sm">
            {ALL_KINDS.map((k) => (
              <label key={k} className="flex items-center gap-1"><input type="checkbox" checked={form.kinds.includes(k)} onChange={() => toggleKind(k)} />{KIND_LABEL[k]}</label>
            ))}
            <button onClick={save} className="ml-auto rounded bg-neutral-900 px-4 py-1.5 text-white">保存</button>
          </div>
        </div>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
            <th className="px-2 py-1">コード</th><th className="px-2 py-1">名称</th><th className="px-2 py-1">区分</th><th className="px-2 py-1">連絡先</th><th className="px-2 py-1"></th>
          </tr>
        </thead>
        <tbody>
          {partners.map((p) => (
            <tr key={p.code} className="border-b border-neutral-100">
              <td className="px-2 py-2 font-mono text-xs">{p.code}</td>
              <td className="px-2 py-2">{p.name}</td>
              <td className="px-2 py-2"><span className="flex flex-wrap gap-1">{p.kinds.map((k) => <span key={k} className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs">{KIND_LABEL[k]}</span>)}</span></td>
              <td className="px-2 py-2 text-xs text-neutral-500">{p.contact ?? ""}</td>
              <td className="px-2 py-2 text-right"><span className="flex justify-end gap-2"><button onClick={() => showActivity(p)} className="text-blue-600 hover:underline">取引</button>{canWrite && <button onClick={() => edit(p)} className="text-blue-600 hover:underline">編集</button>}</span></td>
            </tr>
          ))}
          {partners.length === 0 && <tr><td colSpan={5} className="px-2 py-4 text-center text-sm text-neutral-500">取引先がありません。</td></tr>}
        </tbody>
      </table>

      {activity && (
        <div className="mt-6 rounded border border-neutral-200 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">取引先カルテ：{activity.name}（{activity.code}）</h2>
            <button onClick={() => setActivity(null)} className="text-xs text-neutral-500 hover:underline">閉じる</button>
          </div>
          <div className="mb-3 grid grid-cols-3 gap-3 text-center text-sm">
            <div className="rounded bg-neutral-50 p-2"><div className="text-xs text-neutral-500">請求（売上）</div><div className="font-medium">{yen(activity.data.totalBilled)}</div><div className="text-xs text-neutral-400">{activity.data.invoices.length}件</div></div>
            <div className="rounded bg-neutral-50 p-2"><div className="text-xs text-neutral-500">発注（仕入）</div><div className="font-medium">{yen(activity.data.totalOrdered)}</div><div className="text-xs text-neutral-400">{activity.data.orders.length}件</div></div>
            <div className="rounded bg-neutral-50 p-2"><div className="text-xs text-neutral-500">報酬支払</div><div className="font-medium">{yen(activity.data.totalPaid)}</div><div className="text-xs text-neutral-400">{activity.data.feePayments.length}件</div></div>
          </div>
          {activity.data.invoices.length + activity.data.orders.length + activity.data.feePayments.length === 0 && <p className="text-xs text-neutral-500">この取引先に紐づく取引はまだありません。</p>}
          {activity.data.invoices.map((i) => <div key={`i${i.number}`} className="flex justify-between border-b border-neutral-100 py-1 text-sm"><span>請求 {i.number}・{i.issueDate}</span><span>{yen(i.total)}</span></div>)}
          {activity.data.orders.map((o) => <div key={`o${o.number}`} className="flex justify-between border-b border-neutral-100 py-1 text-sm"><span>発注 {o.number}・{o.orderDate}</span><span>{yen(o.total)}</span></div>)}
          {activity.data.feePayments.map((f, i) => <div key={`f${i}`} className="flex justify-between border-b border-neutral-100 py-1 text-sm"><span>報酬 {f.category}・{f.paidAt}</span><span>{yen(f.base)}（源泉{yen(f.withholding)}）</span></div>)}
        </div>
      )}
    </div>
  );
}