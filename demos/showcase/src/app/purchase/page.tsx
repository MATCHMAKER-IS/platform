"use client";
/** 発注・入荷のデモ: 発注書の金額計算・分納・発注残・過剰入荷の検知。 */
import * as React from "react";
import {
  buildPurchaseOrder,
  receivingStatus,
  totalOutstanding,
  purchaseStatus,
  overReceivedLines,
  type PurchaseOrder,
  type PurchaseLine,
  type Receipt,
  type PurchaseStatus,
} from "@platform/purchase";
import { lineNet } from "@platform/invoice";

const LINES: PurchaseLine[] = [
  { description: "サーバ本体 R740", quantity: 4, unitPrice: 480000, taxRate: 10 },
  { description: "増設メモリ 32GB", quantity: 16, unitPrice: 24000, taxRate: 10 },
  { description: "設置作業", quantity: 1, unitPrice: 120000, taxRate: 10, discount: 20000 },
];

const STATUS_LABEL: Record<PurchaseStatus, string> = {
  draft: "下書き",
  ordered: "発注済（未入荷）",
  partially_received: "一部入荷",
  received: "入荷完了",
  cancelled: "取消",
};

const STATUS_COLOR: Record<PurchaseStatus, string> = {
  draft: "var(--color-muted)",
  ordered: "var(--color-primary)",
  partially_received: "var(--color-warning)",
  received: "var(--color-success)",
  cancelled: "var(--color-muted)",
};

const box: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  background: "var(--color-surface)",
  padding: 16,
  marginBottom: 16,
};

const yen = (n: number) => `¥${n.toLocaleString()}`;

export default function Page() {
  const [state, setState] = React.useState<"draft" | "ordered" | "cancelled">("ordered");
  const [receipts, setReceipts] = React.useState<Receipt[]>([{ lineIndex: 0, quantity: 2, receivedAt: "2026-08-01" }]);

  const order: PurchaseOrder = React.useMemo(
    () => buildPurchaseOrder({ number: "PO-2026-0001", orderDate: "2026-07-17", supplier: "テスト工業株式会社", dueDate: "2026-08-10", state }, LINES, "floor"),
    [state],
  );

  const statuses = receivingStatus(LINES, receipts);
  const outstanding = totalOutstanding(LINES, receipts);
  const status = purchaseStatus(order, receipts);
  const overLines = overReceivedLines(LINES, receipts);

  function receive(lineIndex: number, quantity: number) {
    setReceipts((prev) => [...prev, { lineIndex, quantity, receivedAt: "2026-08-05" }]);
  }

  function receiveAll() {
    setReceipts(statuses.filter((s) => s.outstanding > 0).map((s) => ({ lineIndex: s.lineIndex, quantity: s.outstanding, receivedAt: "2026-08-05" })).concat(receipts));
  }

  return (
    <main style={{ maxWidth: 900, margin: "2.5rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 4 }}>発注・入荷</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.8, marginBottom: 20 }}>
        発注書の金額計算と、<strong>分納（何回かに分けて届く）</strong>の管理です。
        <code>@platform/purchase</code> も税計算は <code>@platform/invoice</code> に委譲しているので、
        <strong>発注・見積・請求で端数処理の方針が揃います</strong>。
        <strong>過剰入荷</strong>（頼んだ数より多く届く）の検知も持っています。
      </p>

      <div style={box}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 4px" }}>発注書 {order.number}</h2>
            <div style={{ fontSize: 12, color: "var(--color-muted)", lineHeight: 1.8 }}>
              仕入先: {order.supplier}
              <br />
              発注日 {order.orderDate} / 希望納期 {order.dueDate}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                display: "inline-block",
                padding: "4px 14px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 700,
                color: STATUS_COLOR[status],
                border: `1px solid ${STATUS_COLOR[status]}`,
                marginBottom: 6,
              }}
            >
              {STATUS_LABEL[status]}
            </div>
            <div style={{ fontSize: 12, color: "var(--color-muted)" }}>
              小計 {yen(order.totals.subtotal)} + 消費税 {yen(order.totals.tax)}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{yen(order.totals.total)}</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          {(["draft", "ordered", "cancelled"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setState(s)}
              style={{
                fontSize: 11,
                padding: "4px 12px",
                borderRadius: 999,
                border: "1px solid var(--color-border)",
                background: state === s ? "var(--color-primary)" : "var(--color-bg)",
                color: state === s ? "var(--color-primary-fg)" : "var(--color-muted)",
                cursor: "pointer",
              }}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 8 }}>
          「下書き」「取消」にすると、入荷があっても状態はそちらが優先されます。
        </p>
      </div>

      <div style={box}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>入荷状況</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={receiveAll}
              style={{ fontSize: 12, padding: "5px 14px", borderRadius: "var(--radius)", border: "none", background: "var(--color-primary)", color: "var(--color-primary-fg)", cursor: "pointer" }}
            >
              残りを全部入荷
            </button>
            <button
              onClick={() => setReceipts([])}
              style={{ fontSize: 12, padding: "5px 14px", borderRadius: "var(--radius)", border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-fg)", cursor: "pointer" }}
            >
              入荷を取消
            </button>
          </div>
        </div>

        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "right", color: "var(--color-muted)" }}>
              <th style={{ padding: 5, textAlign: "left" }}>品目</th>
              <th style={{ padding: 5 }}>単価</th>
              <th style={{ padding: 5 }}>発注</th>
              <th style={{ padding: 5 }}>入荷</th>
              <th style={{ padding: 5 }}>残</th>
              <th style={{ padding: 5, textAlign: "left" }}>入荷を記録</th>
            </tr>
          </thead>
          <tbody>
            {statuses.map((s) => {
              const line = LINES[s.lineIndex];
              const over = overLines.includes(s.lineIndex);
              return (
                <tr
                  key={s.lineIndex}
                  style={{
                    borderTop: "1px solid var(--color-border)",
                    textAlign: "right",
                    background: over ? "color-mix(in srgb, var(--color-danger) 8%, transparent)" : "transparent",
                  }}
                >
                  <td style={{ padding: 5, textAlign: "left" }}>
                    {line?.description}
                    {s.complete && !over && <span style={{ color: "var(--color-success)", marginLeft: 6 }}>完了</span>}
                    {over && <span style={{ color: "var(--color-danger)", marginLeft: 6, fontWeight: 700 }}>過剰入荷</span>}
                  </td>
                  <td style={{ padding: 5, color: "var(--color-muted)" }}>{yen(line ? lineNet(line) : 0)}</td>
                  <td style={{ padding: 5 }}>{s.ordered}</td>
                  <td style={{ padding: 5, fontWeight: 700 }}>{s.received}</td>
                  <td style={{ padding: 5, color: s.outstanding > 0 ? "var(--color-warning)" : "var(--color-muted)" }}>{s.outstanding}</td>
                  <td style={{ padding: 5, textAlign: "left" }}>
                    {[1, 5].map((q) => (
                      <button
                        key={q}
                        onClick={() => receive(s.lineIndex, q)}
                        style={{ fontSize: 11, padding: "2px 8px", marginRight: 4, borderRadius: 4, border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-fg)", cursor: "pointer" }}
                      >
                        +{q}
                      </button>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
          発注残の合計: <b style={{ color: "var(--color-fg)" }}>{outstanding}</b> 点。
          <br />
          <strong>「+5」を押しすぎると過剰入荷になり、行が赤くなります。</strong>
          頼んだ数より多く届くのは現場では普通に起きることで、
          <code>overReceivedLines()</code> が機械的に見つけます。検収で気づかず支払ってしまう事故を防ぐ部分です。
        </p>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>入荷の記録（{receipts.length} 件）</h2>
        {receipts.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--color-muted)" }}>まだありません</p>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {receipts.map((r, i) => (
              <span
                key={i}
                style={{ fontSize: 11, padding: "3px 10px", borderRadius: 999, border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-muted)" }}
              >
                {LINES[r.lineIndex]?.description} ×{r.quantity}（{r.receivedAt}）
              </span>
            ))}
          </div>
        )}
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10 }}>
          入荷は<strong>「記録の積み重ね」</strong>で持ちます。状態を直接書き換えないので、
          いつ何が何個届いたかが後から追えます（電帳法の証跡にもそのまま使えます）。
        </p>
      </div>
    </main>
  );
}
