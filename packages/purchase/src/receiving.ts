/**
 * 入荷・発注残・入荷状態(純ロジック)。
 * 発注明細に対する入荷実績を突き合わせ、未入荷数量(発注残)や入荷状態を求める。
 * @packageDocumentation
 */
import { type PurchaseLine } from "./purchase-order.js";

/** 入荷実績(明細行インデックスごとの数量)。 */
export interface Receipt {
  /** 対象の明細行(0 始まり)。 */
  lineIndex: number;
  /** 入荷数量。 */
  quantity: number;
  /** 入荷日(ISO)。 */
  receivedAt: string;
}

/** 明細ごとの入荷状況。 */
export interface LineReceivingStatus {
  lineIndex: number;
  ordered: number;
  received: number;
  /** 発注残(未入荷数量)。 */
  outstanding: number;
  complete: boolean;
}

/** 発注状態。 */
export type PurchaseStatus = "draft" | "ordered" | "partially_received" | "received" | "cancelled";

/**
 * 明細ごとの入荷状況を集計する。
 *
 * @param order 発注書
 * @param receipts 入荷の記録
 * @returns 明細ごとの発注数・入荷数・残
 */
export function receivingStatus(lines: PurchaseLine[], receipts: Receipt[]): LineReceivingStatus[] {
  return lines.map((line, i) => {
    const received = receipts.filter((r) => r.lineIndex === i).reduce((s, r) => s + r.quantity, 0);
    const ordered = line.quantity;
    const outstanding = Math.max(0, ordered - received);
    return { lineIndex: i, ordered, received, outstanding, complete: outstanding === 0 };
  });
}

/**
 * 発注残の合計を返す。
 *
 * **未入荷を放置しない**ため(発注したのに届いていないものを可視化する)。
 *
 * @param order 発注書
 * @param receipts 入荷の記録
 * @returns 残数の合計
 */
export function totalOutstanding(lines: PurchaseLine[], receipts: Receipt[]): number {
  return receivingStatus(lines, receipts).reduce((s, l) => s + l.outstanding, 0);
}

/**
 * 発注全体の入荷状態を判定する。
 *
 * @param order 発注書
 * @param receipts 入荷の記録
 * @returns `pending`(未入荷)/ `partial`(一部)/ `complete`(完了)
 */
export function purchaseStatus(
  order: { lines: PurchaseLine[]; state?: "draft" | "ordered" | "cancelled" },
  receipts: Receipt[],
): PurchaseStatus {
  if (order.state === "cancelled") return "cancelled";
  if (order.state === "draft") return "draft";
  const statuses = receivingStatus(order.lines, receipts);
  const totalReceived = statuses.reduce((s, l) => s + l.received, 0);
  if (totalReceived === 0) return "ordered";
  return statuses.every((l) => l.complete) ? "received" : "partially_received";
}

/**
 * 過入荷の明細を返す(発注数量を超える入荷)。
 *
 * **発注より多く届くのは異常**(誤配送・入力ミス)。検収の前に気づく必要がある
 * (受け入れてしまうと、請求と合わなくなる)。
 *
 * @param order 発注書
 * @param receipts 入荷の記録
 * @returns 過入荷の明細と超過数
 */
export function overReceivedLines(lines: PurchaseLine[], receipts: Receipt[]): number[] {
  return lines
    .map((line, i) => {
      const received = receipts.filter((r) => r.lineIndex === i).reduce((s, r) => s + r.quantity, 0);
      return received > line.quantity ? i : -1;
    })
    .filter((i) => i >= 0);
}
