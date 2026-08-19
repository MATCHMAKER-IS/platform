"use client";
/** 発注管理。発注書の一覧（入荷状況）、発注点割れからの起票、入荷記録（在庫へ入庫反映）。 */
import * as React from "react";
import { PromptDialog, Button, Select, PageShell } from "@platform/ui";

interface Line { description: string; quantity: number; unitPrice: number; }
interface LineStatus { lineIndex: number; ordered: number; received: number; outstanding: number; complete: boolean; }
interface Order { number: string; orderDate: string; supplier: string; dueDate?: string; lines: Line[]; totals: { subtotal: number; tax: number; total: number }; }
interface PurchaseView { number: string; order: Order; skus: (string | null)[]; status: string; lineStatus: LineStatus[]; outstanding: number; }

const STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: "下書き", cls: "bg-[var(--color-subtle)] text-[var(--color-fg)]" },
  ordered: { label: "発注済", cls: "bg-[color-mix(in_srgb,var(--color-primary)_15%,transparent)] text-[var(--color-primary)]" },
  partially_received: { label: "一部入荷", cls: "bg-[color-mix(in_srgb,var(--color-warning)_15%,transparent)] text-[var(--color-warning)]" },
  received: { label: "入荷完了", cls: "bg-[color-mix(in_srgb,var(--color-success)_15%,transparent)] text-[var(--color-success)]" },
  cancelled: { label: "取消", cls: "bg-[var(--color-subtle-strong)] text-[var(--color-muted)]" },
};

export interface PurchaseOrdersClientProps { fetchImpl?: typeof fetch; canWrite?: boolean; }

export function PurchaseOrdersClient({ fetchImpl, canWrite = true }: PurchaseOrdersClientProps) {
  const [orders, setOrders] = React.useState<PurchaseView[]>([]);
  const [open, setOpen] = React.useState<string | null>(null);
  const [error, setError] = React.useState("");
  // 入荷を記録しようとしている明細(null なら尋ねない)
  const [receiving, setReceiving] = React.useState<{ number: string; lineIndex: number; outstanding: number } | null>(null);
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

  /**
   * 入荷を記録する。
   *
   * **数量は画面で受ける。** `window.prompt` は数字以外を弾けず、
   * **発注残を超える入荷**も止められなかった。
   */
  const receive = async (number: string, lineIndex: number, qty: number) => {
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
    <PageShell title="発注" width="wide">
        {canWrite && (
          <span className="flex items-center gap-2">
            {suppliers.length > 0 && (
              <Select
                value={supplierCode} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSupplierCode(e.target.value)} className="rounded border border-[var(--color-border)] px-2 py-1 text-sm"
                options={[
                  { label: "仕入先を選択…", value: "" }, ...suppliers.map((sp) => ({ label: sp.name, value: String(sp.code) })),
                ]}
              />
            )}
      <Button onClick={createFromReorder} className="rounded px-4 py-2 text-sm text-white">発注点割れから起票</Button>
          </span>
        )}
      {approvalMsg && <p className="mb-2 rounded bg-[color-mix(in_srgb,var(--color-primary)_8%,transparent)] px-3 py-2 text-sm text-[var(--color-primary)]">{approvalMsg}</p>}
      <p className="mb-4 text-xs text-[var(--color-muted)]">在庫の発注点を割った商品から発注書を作成します。入荷を記録すると在庫に入庫として反映されます。</p>
      {error && <p className="mb-3 rounded bg-[color-mix(in_srgb,var(--color-danger)_8%,transparent)] px-3 py-2 text-sm text-[var(--color-danger)]">{error}</p>}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-muted)]">
            <th className="px-2 py-1">発注番号</th><th className="px-2 py-1">仕入先</th><th className="px-2 py-1">発注日</th>
            <th className="px-2 py-1 text-right">発注残</th><th className="px-2 py-1">状態</th><th className="px-2 py-1"></th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <React.Fragment key={o.number}>
              <tr className="border-b border-[var(--color-border)]">
        <td className="px-2 py-2 font-mono text-xs"><Button variant="ghost" onClick={() => setOpen(open === o.number ? null : o.number)} className="text-[var(--color-primary)] hover:underline">{o.number}</Button>{canWrite && <Button variant="ghost" onClick={() => submitApproval(o.number, o.order.totals.total)} className="ml-2 text-xs text-[var(--color-primary)] hover:underline">承認申請</Button>}</td>
        <td className="px-2 py-2">{o.order.supplier}{(() => { const a = approvals[o.number]; if (!a) return canWrite ? <Button variant="ghost" onClick={() => submitApproval(o.number, o.order.totals.total)} className="ml-2 text-xs text-[var(--color-primary)] hover:underline">承認申請</Button> : null; const label = a.status === "approved" ? "承認済" : a.status === "rejected" ? "却下" : `承認待ち ${a.currentStep}/${a.totalSteps}`; const cls = a.status === "approved" ? "bg-[color-mix(in_srgb,var(--color-success)_15%,transparent)] text-[var(--color-success)]" : a.status === "rejected" ? "bg-[color-mix(in_srgb,var(--color-danger)_15%,transparent)] text-[var(--color-danger)]" : "bg-[color-mix(in_srgb,var(--color-warning)_15%,transparent)] text-[var(--color-warning)]"; return <span className={`ml-2 rounded px-1.5 py-0.5 text-xs ${cls}`}>{label}</span>; })()}</td>
                <td className="px-2 py-2 text-xs text-[var(--color-muted)]">{o.order.orderDate}</td>
                <td className="px-2 py-2 text-right">{o.outstanding}</td>
                <td className="px-2 py-2"><span className={`rounded px-2 py-0.5 text-xs ${STATUS[o.status]?.cls ?? "bg-[var(--color-subtle)]"}`}>{STATUS[o.status]?.label ?? o.status}</span></td>
                <td className="px-2 py-2"></td>
              </tr>
              {open === o.number && (
                <tr><td colSpan={6} className="bg-[var(--color-subtle)] px-4 py-3">
                  <table className="w-full text-xs">
                    <thead><tr className="text-left text-[var(--color-muted)]"><th className="px-2 py-1">品目</th><th className="px-2 py-1">SKU</th><th className="px-2 py-1 text-right">発注</th><th className="px-2 py-1 text-right">入荷</th><th className="px-2 py-1 text-right">残</th><th className="px-2 py-1"></th></tr></thead>
                    <tbody>
                      {o.lineStatus.map((ls) => (
                        <tr key={ls.lineIndex} className="border-t border-[var(--color-border)]">
                          <td className="px-2 py-1">{o.order.lines[ls.lineIndex]?.description ?? ""}</td>
                          <td className="px-2 py-1 font-mono">{o.skus[ls.lineIndex] ?? "—"}</td>
                          <td className="px-2 py-1 text-right">{ls.ordered}</td>
                          <td className="px-2 py-1 text-right">{ls.received}</td>
                          <td className="px-2 py-1 text-right">{ls.outstanding}</td>
             <td className="px-2 py-1 text-right">{canWrite && !ls.complete && o.status !== "cancelled" && <Button variant="ghost" onClick={() => setReceiving({ number: o.number, lineIndex: ls.lineIndex, outstanding: ls.outstanding })} className="text-[var(--color-primary)] hover:underline">入荷</Button>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </td></tr>
              )}
            </React.Fragment>
          ))}
          {orders.length === 0 && <tr><td colSpan={6} className="px-2 py-4 text-center text-sm text-[var(--color-muted)]">発注書がありません。</td></tr>}
        </tbody>
      </table>
      {/* **発注残を超える入荷を弾く。**
          `window.prompt` では数量の妥当性を確かめられなかった */}
      <PromptDialog
        open={receiving !== null}
        onClose={() => setReceiving(null)}
        onSubmit={(v) => {
          if (receiving !== null) void receive(receiving.number, receiving.lineIndex, Number(v));
        }}
        title="入荷を記録"
        description={receiving !== null ? `発注残 ${receiving.outstanding}` : ""}
        label="入荷数量"
        type="number"
        defaultValue={receiving !== null ? String(receiving.outstanding) : ""}
        submitLabel="記録する"
        validate={(v) => {
          const n = Number(v);
          if (!(n > 0)) return "1 以上を入力してください";
          if (receiving !== null && n > receiving.outstanding) {
            return `発注残(${receiving.outstanding})を超えています`;
          }
          return undefined;
        }}
      />
    </PageShell>
  );
}
