"use client";
/**
 * 商流(見積 → 発注 → 入荷 → 在庫 → 請求)の UI 画面。
 * flow.ts のオーケストレーションを Steps + Card + StatCard + Badge で可視化する。
 * @packageDocumentation
 */
import * as React from "react";
import { Steps, Card, StatCard, Badge, Button } from "@platform/ui";
import { step1_quote, step2_purchaseOrder, step3_receive, step4_stock, step5_invoice } from "./flow.js";
import { type InvoiceLine } from "@platform/invoice";

const STEP_LABELS = ["見積", "発注", "入荷", "在庫", "請求"];

/** サンプル明細。 */
const LINES: InvoiceLine[] = [
  { description: "部品A", quantity: 100, unitPrice: 500 },
  { description: "部品B(軽減)", quantity: 50, unitPrice: 200, taxRate: 8 },
];
const POLICY = { safetyStock: 20, dailyDemand: 5, leadTimeDays: 7 };

/** 商流を 1 画面で辿るデモ。 */
export function ProcureToPayScreen() {
  const [step, setStep] = React.useState(0);

  const quote = step1_quote("株式会社顧客", LINES);
  const po = step2_purchaseOrder("仕入先株式会社", LINES);
  const receipts = [{ lineIndex: 0, quantity: 80, receivedAt: "2025-07-10" }];
  const receiving = step3_receive(po, receipts);
  const stock = step4_stock(po, receipts, POLICY);
  const billing = step5_invoice(quote);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Steps steps={STEP_LABELS} current={step} />

      {step === 0 && (
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">見積 {quote.number}</h2>
            <Badge>{quote.billTo}</Badge>
          </div>
          <StatCard label="見積金額(税込)" value={quote.totals.total} format="currency" />
        </Card>
      )}

      {step === 1 && (
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">発注 {po.number}</h2>
            <Badge tone="info">{po.supplier}</Badge>
          </div>
          <StatCard label="発注金額(税込)" value={po.totals.total} format="currency" />
        </Card>
      )}

      {step === 2 && (
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">入荷状況</h2>
            <Badge tone={receiving.status === "received" ? "success" : "warning"}>
              {receiving.status === "partially_received" ? "一部入荷" : receiving.status}
            </Badge>
          </div>
          <ul className="flex flex-col gap-2 text-sm">
            {receiving.lines.map((l) => (
              <li key={l.lineIndex} className="flex justify-between rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-2">
                <span>{LINES[l.lineIndex]?.description}</span>
                <span className="text-[var(--color-muted)]">入荷 {l.received} / 発注残 {l.outstanding}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {step === 3 && (
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold">在庫・評価</h2>
          <div className="grid grid-cols-2 gap-4">
            <StatCard label="現在庫" value={stock.onHand} format="number" />
            <StatCard label="在庫金額(移動平均)" value={stock.valuation.value} format="currency" />
          </div>
          {stock.needsReorder && (
            <p className="mt-4 rounded-[var(--radius)] bg-amber-50 px-3 py-2 text-sm text-amber-700">
              補充が必要です。推奨発注数: {stock.suggested}
            </p>
          )}
        </Card>
      )}

      {step === 4 && (
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">請求 {billing.invoice.number}</h2>
            <Badge tone={billing.status === "paid" ? "success" : "info"}>{billing.status}</Badge>
          </div>
          <StatCard label="請求金額(税込)" value={billing.invoice.totals.total} format="currency" />
        </Card>
      )}

      <div className="flex justify-between">
        <Button variant="secondary" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>戻る</Button>
        <Button onClick={() => setStep((s) => Math.min(STEP_LABELS.length - 1, s + 1))} disabled={step === STEP_LABELS.length - 1}>次へ</Button>
      </div>
    </div>
  );
}
