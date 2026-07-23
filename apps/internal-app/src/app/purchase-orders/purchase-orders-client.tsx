"use client";
/** 発注管理。発注書の一覧（入荷状況）、発注点割れからの起票、入荷記録（在庫へ入庫反映）。 */
import * as React from "react";
import { Button, Select } from "@platform/ui";

interface Line { description: string; quantity: number; unitPrice: number; }
interface LineStatus { lineIndex: number; ordered: number; received: number; outstanding: number; complete: boolean; }
interface Order { number: string; orderDate: string; supplier: string; dueDate?: string; lines: Line[]; totals: { subtotal: number; tax: number; total: number }; }
interface PurchaseView { number: string; order: Order; skus: (string | null)[]; status: string; lineStatus: LineStatus[]; outstanding: number; }

const STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: "下書き", cls: "bg-neutral-100 text-neutral-700" },
  ordered: { label: "発注済", cls: "bg-blue-100 text-blue-800" },
  partially_received: { label: "一部入荷", cls: "bg-amber-100 text-amber-800" },
  received: { label: "入荷完了", cls: "bg-green-100 text-green-800" },
  cancelled: { label: "取消", cls: "bg-neutral-200 text-neutral-500" },
};

export interface PurchaseOrdersClientProps { fetchImpl?: typeof fetch; canWrite?: boolean; }

export function PurchaseOrdersClient({ fetchImpl, canWrite = true }: PurchaseOrdersClientProps) {
  const [orders, setOrders] = React.useState<PurchaseView[]>([]);
  const [open, setOpen] = React.useState<string | null>(null);
  const [error, setError] = React.useState("");
  const [suppliers, setSuppliers] = React.useState<{ code: string; name: string }[]>([]);
  const [supplierCode, setSupplierCode] = React.useState("");
  const [approvals, setApprovals] = React.useState<Record<string, { status: string; currentStep: number; totalSteps: number }>>({});
  const [approvalMsg, setApprovalMsg] = React.useState("");
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;

  const reload = React.useCallback(async () => {
    const sup = await doFetch("/api/partners?kind=supplier");
    if (sup.ok) setSuppliers(((await sup.json()) as { partners: { code: string; name: string }[] }).partners);
    const appr = await doFetch("/api/approvals/status?docType=purchase");
    if (appr.ok) setApprovals(((await appr.json()) as { statuses: Record<string, { status: string; currentStep: number; totalSteps: number }> }).statuses);
    const res = await doFetch("/api/purchase-orders");
    if (res.ok) setOrders(((await res.json()) as { orders: PurchaseView[] }).orders);
  }, [doFetch]);
  React.useEffect(() => { void reload(); }, [reload]);

  const createFromReorder = async () => {
    setError("");
    const res = await doFetch("/api/purchase-orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(supplierCode ? { partnerCode: supplierCode } : {}) });
    const data = (await res.json()) as { order?: PurchaseView; error?: string };
    if (res.ok && data.order) await reload();
    else setError(data.error ?? "発注が必要な商品はありません");
  };

  const receive = async (number: string, lineIndex: number, outstanding: number) => {
    const input = (globalThis as unknown as { prompt: (m: string, d?: string) => string | null }).prompt("入荷数量を入力してください", String(outstanding));
    const qty = Number(input);
    if (!input || Number.isNaN(qty) || qty <= 0) return;
    const res = await doFetch(`/api/purchase-orders/${number}/receipts`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lineIndex, quantity: qty }) });
    if (res.ok) await reload();
    else setError(((await res.json()) as { error?: string }).error ?? "入荷記録に失敗しました");
  };

  const submitApproval = async (number: string, amount: number) => {
    setApprovalMsg("");
    const res = await doFetch("/api/approvals/submit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ docType: "purchase", docNumber: number, amount }) });
    if (res.ok) { const d = (await res.json()) as { totalSteps: number }; setApprovalMsg(`${number} を承認申請しました（${d.totalSteps}段）`); }
    else setApprovalMsg(((await res.json()) as { error?: string }).error ?? "申請に失敗しました");
  };

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">発注</h1>
        {canWrite && (
          <span className="flex items-center gap-2">
            {suppliers.length > 0 && (
              <Select value={supplierCode} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSupplierCode(e.target.value)} className="rounded border border-neutral-300 px-2 py-1 text-sm" options={[{ label: "仕入先を選択…", value: "" }, ...suppliers.map((sp) => ({ label: sp.name, value: String(sp.code) }))]} />
            )}
            <Button onClick={createFromReorder} className="rounded bg-neutral-900 px-4 py-2 text-sm text-white">発注点割れから起票</Button>
          </span>
        )}
      </div>
      {approvalMsg && <p className="mb-2 rounded bg-blue-50 px-3 py-2 text-sm text-blue-700">{approvalMsg}</p>}
      <p className="mb-4 text-xs text-neutral-500">在庫の発注点を割った商品から発注書を作成します。入荷を記録すると在庫に入庫として反映されます。</p>
      {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
            <th className="px-2 py-1">発注番号</th><th className="px-2 py-1">仕入先</th><th className="px-2 py-1">発注日</th>
            <th className="px-2 py-1 text-right">発注残</th><th className="px-2 py-1">状態</th><th className="px-2 py-1"></th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <React.Fragment key={o.number}>
              <tr className="border-b border-neutral-100">
                <td className="px-2 py-2 font-mono text-xs"><Button onClick={() => setOpen(open === o.number ? null : o.number)} className="text-blue-600 hover:underline">{o.number}</Button>{canWrite && <Button onClick={() => submitApproval(o.number, o.order.totals.total)} className="ml-2 text-xs text-blue-600 hover:underline">承認申請</Button>}</td>
                <td className="px-2 py-2">{o.order.supplier}{(() => { const a = approvals[o.number]; if (!a) return canWrite ? <Button onClick={() => submitApproval(o.number, o.order.totals.total)} className="ml-2 text-xs text-blue-600 hover:underline">承認申請</Button> : null; const label = a.status === "approved" ? "承認済" : a.status === "rejected" ? "却下" : `承認待ち ${a.currentStep}/${a.totalSteps}`; const cls = a.status === "approved" ? "bg-green-100 text-green-800" : a.status === "rejected" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"; return <span className={`ml-2 rounded px-1.5 py-0.5 text-xs ${cls}`}>{label}</span>; })()}</td>
                <td className="px-2 py-2 text-xs text-neutral-500">{o.order.orderDate}</td>
                <td className="px-2 py-2 text-right">{o.outstanding}</td>
                <td className="px-2 py-2"><span className={`rounded px-2 py-0.5 text-xs ${STATUS[o.status]?.cls ?? "bg-neutral-100"}`}>{STATUS[o.status]?.label ?? o.status}</span></td>
                <td className="px-2 py-2"></td>
              </tr>
              {open === o.number && (
                <tr><td colSpan={6} className="bg-neutral-50 px-4 py-3">
                  <table className="w-full text-xs">
                    <thead><tr className="text-left text-neutral-500"><th className="px-2 py-1">品目</th><th className="px-2 py-1">SKU</th><th className="px-2 py-1 text-right">発注</th><th className="px-2 py-1 text-right">入荷</th><th className="px-2 py-1 text-right">残</th><th className="px-2 py-1"></th></tr></thead>
                    <tbody>
                      {o.lineStatus.map((ls) => (
                        <tr key={ls.lineIndex} className="border-t border-neutral-200">
                          <td className="px-2 py-1">{o.order.lines[ls.lineIndex]?.description ?? ""}</td>
                          <td className="px-2 py-1 font-mono">{o.skus[ls.lineIndex] ?? "—"}</td>
                          <td className="px-2 py-1 text-right">{ls.ordered}</td>
                          <td className="px-2 py-1 text-right">{ls.received}</td>
                          <td className="px-2 py-1 text-right">{ls.outstanding}</td>
                          <td className="px-2 py-1 text-right">{canWrite && !ls.complete && o.status !== "cancelled" && <Button onClick={() => receive(o.number, ls.lineIndex, ls.outstanding)} className="text-blue-600 hover:underline">入荷</Button>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </td></tr>
              )}
            </React.Fragment>
          ))}
          {orders.length === 0 && <tr><td colSpan={6} className="px-2 py-4 text-center text-sm text-neutral-500">発注書がありません。</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
