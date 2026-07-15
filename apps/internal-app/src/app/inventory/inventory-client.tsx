"use client";
/** 在庫管理画面。在庫状況の一覧、発注アラート、入出庫の記録、商品登録。 */
import * as React from "react";

interface MovementSummary { totalIn: number; totalOut: number; adjustments: number; onHand: number; }
interface Product { sku: string; name: string; unit: string; policy?: { safetyStock: number; dailyDemand: number; leadTimeDays: number; targetLevel?: number }; }
interface StockStatus { product: Product; summary: MovementSummary; needsReorder: boolean; suggestedOrderQty: number; }
interface LedgerMovement { type: "inbound" | "outbound" | "adjustment"; quantity: number; at: string; ref?: string; unitCost?: number; warehouse?: string; lotId?: string; expiry?: string; }
interface WarehouseStock { warehouse: string; onHand: number; }
interface LotBalance { lotId: string; quantity: number; expiry?: string; }
interface InventoryDetail { product: Product; movements: LedgerMovement[]; byWarehouse: WarehouseStock[]; expiringSoon: LotBalance[]; expired: LotBalance[]; }
interface PoLine { description: string; quantity: number; unitPrice: number; }
interface PurchaseOrder { number: string; orderDate: string; supplier: string; dueDate?: string; lines: PoLine[]; totals: { subtotal: number; tax: number; total: number }; }
const MOVE_LABEL: Record<string, string> = { inbound: "入庫", outbound: "出庫", adjustment: "調整" };

export interface InventoryClientProps { fetchImpl?: typeof fetch; canWrite?: boolean; }

export function InventoryClient({ fetchImpl, canWrite = true }: InventoryClientProps) {
  const [rows, setRows] = React.useState<StockStatus[]>([]);
  const [move, setMove] = React.useState<{ sku: string; type: "inbound" | "outbound" | "adjustment"; quantity: string; ref: string; warehouse: string; lotId: string; expiry: string }>({ sku: "", type: "inbound", quantity: "", ref: "", warehouse: "", lotId: "", expiry: "" });
  const [detail, setDetail] = React.useState<InventoryDetail | null>(null);
  const [draft, setDraft] = React.useState<PurchaseOrder | null>(null);
  const [newProduct, setNewProduct] = React.useState<{ sku: string; name: string; unit: string }>({ sku: "", name: "", unit: "個" });
  const [error, setError] = React.useState("");
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;

  const reload = React.useCallback(async () => {
    const res = await doFetch("/api/inventory");
    if (res.ok) setRows(((await res.json()) as { status: StockStatus[] }).status);
  }, [doFetch]);

  React.useEffect(() => { void reload(); }, [reload]);

  const submitMove = async () => {
    setError("");
    const qty = Number(move.quantity);
    if (!move.sku || Number.isNaN(qty)) { setError("商品と数量を入力してください"); return; }
    const res = await doFetch("/api/inventory/movements", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sku: move.sku, type: move.type, quantity: qty, ...(move.ref ? { ref: move.ref } : {}), ...(move.warehouse ? { warehouse: move.warehouse } : {}), ...(move.lotId ? { lotId: move.lotId } : {}), ...(move.expiry ? { expiry: move.expiry } : {}) }) });
    if (res.ok) { setMove({ sku: "", type: "inbound", quantity: "", ref: "", warehouse: "", lotId: "", expiry: "" }); await reload(); if (detail) await openDetail(detail.product.sku); }
    else setError(((await res.json()) as { error?: string }).error ?? "記録に失敗しました");
  };

  const submitProduct = async () => {
    setError("");
    if (!newProduct.sku || !newProduct.name) { setError("SKU と品名を入力してください"); return; }
    const res = await doFetch("/api/inventory", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(newProduct) });
    if (res.ok) { setNewProduct({ sku: "", name: "", unit: "個" }); await reload(); }
    else setError(((await res.json()) as { error?: string }).error ?? "登録に失敗しました");
  };

  const openDetail = async (sku: string) => {
    if (detail?.product.sku === sku) { setDetail(null); return; }
    const res = await doFetch(`/api/inventory/${sku}`);
    if (res.ok) setDetail((await res.json()) as InventoryDetail);
  };

  const createDraft = async () => {
    setError("");
    const res = await doFetch("/api/inventory/reorder-draft", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
    const data = (await res.json()) as { order?: PurchaseOrder; error?: string };
    if (data.order) setDraft(data.order);
    else setError(data.error ?? "発注が必要な商品はありません");
  };

  const reorderCount = rows.filter((r) => r.needsReorder).length;

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="mb-1 text-2xl font-bold">在庫管理</h1>
      {reorderCount > 0 && (
        <div className="mb-4 flex items-center justify-between rounded bg-amber-50 px-3 py-2">
          <p className="text-sm text-amber-800">発注が必要な商品が {reorderCount} 件あります。</p>
          {canWrite && <button onClick={createDraft} className="rounded bg-amber-600 px-3 py-1 text-sm text-white">発注書ドラフトを作成</button>}
        </div>
      )}
      {draft && (
        <div className="mb-4 rounded border border-amber-300 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">発注書ドラフト {draft.number}（{draft.supplier}）</span>
            <button onClick={() => setDraft(null)} className="text-xs text-neutral-500">閉じる</button>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {draft.lines.map((l, i) => (<tr key={i} className="border-b border-neutral-100"><td className="px-2 py-1">{l.description}</td><td className="px-2 py-1 text-right">{l.quantity}</td></tr>))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-neutral-500">単価は仮（0円）です。実際の発注では単価・仕入先を補記してください。</p>
        </div>
      )}
      {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <table className="mb-6 w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
            <th className="px-2 py-1">SKU</th><th className="px-2 py-1">品名</th><th className="px-2 py-1 text-right">現在庫</th>
            <th className="px-2 py-1 text-right">入庫計</th><th className="px-2 py-1 text-right">出庫計</th><th className="px-2 py-1">発注</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.product.sku} className="border-b border-neutral-100">
              <td className="px-2 py-2 font-mono text-xs"><button onClick={() => openDetail(r.product.sku)} className="text-blue-600 hover:underline">{r.product.sku}</button></td>
              <td className="px-2 py-2">{r.product.name}</td>
              <td className="px-2 py-2 text-right font-medium">{r.summary.onHand} {r.product.unit}</td>
              <td className="px-2 py-2 text-right text-neutral-500">{r.summary.totalIn}</td>
              <td className="px-2 py-2 text-right text-neutral-500">{r.summary.totalOut}</td>
              <td className="px-2 py-2">{r.needsReorder ? <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">要発注 {r.suggestedOrderQty}</span> : <span className="text-xs text-neutral-400">—</span>}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={6} className="px-2 py-4 text-center text-sm text-neutral-500">商品がありません。</td></tr>}
        </tbody>
      </table>

      {detail && (
        <div className="mb-6 rounded border border-neutral-200 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium">{detail.product.sku}・{detail.product.name} の詳細</h2>
            <button onClick={() => setDetail(null)} className="text-xs text-neutral-500">閉じる</button>
          </div>
          <div className="mb-3 flex flex-wrap gap-2 text-xs">
            {detail.byWarehouse.map((w) => (<span key={w.warehouse} className="rounded bg-neutral-100 px-2 py-1">{w.warehouse}: {w.onHand}</span>))}
          </div>
          {(detail.expired.length > 0 || detail.expiringSoon.length > 0) && (
            <div className="mb-3 text-xs">
              {detail.expired.length > 0 && <p className="text-red-700">期限切れ: {detail.expired.map((l) => `${l.lotId}(${l.quantity})`).join("、")}</p>}
              {detail.expiringSoon.length > 0 && <p className="text-amber-700">期限間近: {detail.expiringSoon.map((l) => `${l.lotId}(${l.quantity}・${l.expiry ?? ""})`).join("、")}</p>}
            </div>
          )}
          <table className="w-full text-xs">
            <thead><tr className="border-b border-neutral-200 text-left text-neutral-500"><th className="px-2 py-1">日時</th><th className="px-2 py-1">種別</th><th className="px-2 py-1 text-right">数量</th><th className="px-2 py-1">倉庫/ロット</th><th className="px-2 py-1">参照</th></tr></thead>
            <tbody>
              {detail.movements.map((m, i) => (
                <tr key={i} className="border-b border-neutral-100">
                  <td className="px-2 py-1 text-neutral-500">{m.at.slice(0, 16).replace("T", " ")}</td>
                  <td className="px-2 py-1">{MOVE_LABEL[m.type]}</td>
                  <td className="px-2 py-1 text-right">{m.quantity}</td>
                  <td className="px-2 py-1 text-neutral-500">{[m.warehouse, m.lotId].filter(Boolean).join(" / ") || "—"}</td>
                  <td className="px-2 py-1 text-neutral-500">{m.ref ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {canWrite && (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded border border-neutral-200 p-4">
            <h2 className="mb-3 text-sm font-medium">入出庫の記録</h2>
            <div className="flex flex-col gap-2">
              <select value={move.sku} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setMove({ ...move, sku: e.target.value })} className="rounded border border-neutral-300 px-2 py-1 text-sm">
                <option value="">商品を選択</option>
                {rows.map((r) => <option key={r.product.sku} value={r.product.sku}>{r.product.sku}・{r.product.name}</option>)}
              </select>
              <div className="flex gap-2">
                <select value={move.type} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setMove({ ...move, type: e.target.value as typeof move.type })} className="rounded border border-neutral-300 px-2 py-1 text-sm">
                  <option value="inbound">入庫</option><option value="outbound">出庫</option><option value="adjustment">調整</option>
                </select>
                <input value={move.quantity} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMove({ ...move, quantity: e.target.value })} placeholder="数量" inputMode="numeric" className="w-24 rounded border border-neutral-300 px-2 py-1 text-sm" />
                <input value={move.ref} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMove({ ...move, ref: e.target.value })} placeholder="参照（発注/出荷番号）" className="flex-1 rounded border border-neutral-300 px-2 py-1 text-sm" />
              </div>
              <div className="flex gap-2">
                <input value={move.warehouse} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMove({ ...move, warehouse: e.target.value })} placeholder="倉庫（任意）" className="flex-1 rounded border border-neutral-300 px-2 py-1 text-sm" />
                <input value={move.lotId} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMove({ ...move, lotId: e.target.value })} placeholder="ロット（任意）" className="w-28 rounded border border-neutral-300 px-2 py-1 text-sm" />
                <input type="date" value={move.expiry} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMove({ ...move, expiry: e.target.value })} className="rounded border border-neutral-300 px-2 py-1 text-sm" />
              </div>
              <button onClick={submitMove} className="self-start rounded bg-neutral-900 px-4 py-1.5 text-sm text-white">記録する</button>
              <p className="text-xs text-neutral-400">調整はマイナスも入力できます（棚卸差異など）。</p>
            </div>
          </div>

          <div className="rounded border border-neutral-200 p-4">
            <h2 className="mb-3 text-sm font-medium">商品を登録</h2>
            <div className="flex flex-col gap-2">
              <input value={newProduct.sku} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewProduct({ ...newProduct, sku: e.target.value })} placeholder="SKU" className="rounded border border-neutral-300 px-2 py-1 text-sm" />
              <input value={newProduct.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewProduct({ ...newProduct, name: e.target.value })} placeholder="品名" className="rounded border border-neutral-300 px-2 py-1 text-sm" />
              <input value={newProduct.unit} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewProduct({ ...newProduct, unit: e.target.value })} placeholder="単位" className="w-24 rounded border border-neutral-300 px-2 py-1 text-sm" />
              <button onClick={submitProduct} className="self-start rounded border border-neutral-300 px-4 py-1.5 text-sm">登録する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
