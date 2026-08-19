import { AppError, ErrorCode } from "@platform/core";
/**
 * 見積(純ロジック)。明細計算は @platform/invoice を再利用し、見積特有の有効期限・状態・請求書変換を持つ。
 * @packageDocumentation
 */
import { invoiceTotals, type InvoiceLine, type InvoiceTotals, type Invoice, buildInvoice, type Rounding } from "@platform/invoice";

/** 見積の状態。 */
export type QuoteStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";

/** 見積書。 */
export interface Quote {
  /** 見積番号(自社採番)。 */
  number: string;
  /** 発行日(ISO)。 */
  issueDate: string;
  /** 有効期限(ISO)。 */
  validUntil: string;
  /** 宛先。 */
  billTo: string;
  lines: InvoiceLine[];
  totals: InvoiceTotals;
  /** 記録上の状態(accepted/rejected は明示操作)。 */
  state?: "draft" | "sent" | "accepted" | "rejected";
}

/**
 * 見積の合計を計算する。
 *
 * **税計算は `@platform/invoice` に委譲**(請求書と同じ計算にする)。
 *
 * @param lines 明細
 * @param rounding 端数処理（既定 floor）
 * @returns 小計・税額・合計
 */
export function quoteTotals(lines: InvoiceLine[], rounding: Rounding = "floor"): InvoiceTotals {
  return invoiceTotals(lines, rounding);
}

/**
 * 見積を組み立てる。
 *
 * @param header 取引先・日付・有効期限など
 * @param lines 明細
 * @param rounding 端数処理（既定 floor）
 * @returns 見積(金額は自動計算)
 */
export function buildQuote(
  header: { number: string; issueDate: string; validUntil: string; billTo: string; state?: Quote["state"] },
  lines: InvoiceLine[],
  rounding: Rounding = "floor",
): Quote {
  return { ...header, lines, totals: quoteTotals(lines, rounding) };
}

/**
 * 有効期限切れかを判定する。
 *
 * @param quote 見積
 * @param now 基準日(テスト注入用)
 * @returns 期限を過ぎていれば true。**期限が無ければ false**
 */
export function isExpired(quote: Pick<Quote, "validUntil">, now: Date = new Date()): boolean {
  // **JST の日付で比べる。** `getFullYear()` などはサーバのローカル時刻で動くので、
  // UTC のサーバ(クラウドの既定)では**JST の 00:00〜08:59 が前日**として扱われる
  // ——JST で 8/11 00:30 なら期限切れのはずが、UTC では「まだ 8/10」で**有効と判定**される。
  //
  // 「あと 9 時間だけ使える見積」が生まれ、**失効したはずの価格で受注**しうる。
  // 依存を増やさないため、9 時間ずらして UTC として読む(2026-08 に修正)。
  const jstDay = (d: Date): string =>
    new Date(d.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return jstDay(now) > jstDay(new Date(quote.validUntil));
}

/**
 * 見積の表示状態を判定する。
 *
 * **明示的な状態を優先**(承認済み・却下は、期限が過ぎても期限切れとは表示しない。
 * 「承認したのに期限切れ」では意味が通らない)。
 *
 * @param quote 見積
 * @param now 基準日(テスト注入用)
 * @returns 表示する状態
 */
export function quoteStatus(quote: Pick<Quote, "validUntil" | "state">, now: Date = new Date()): QuoteStatus {
  if (quote.state === "accepted") return "accepted";
  if (quote.state === "rejected") return "rejected";
  if (isExpired(quote, now)) return "expired";
  return quote.state === "sent" ? "sent" : "draft";
}

/**
 * 有効期限までの日数を返す。
 *
 * @param quote 見積
 * @param now 基準日(テスト注入用)
 * @returns 残り日数(**過ぎていれば負**)。期限が無ければ undefined
 */
export function daysUntilExpiry(quote: Pick<Quote, "validUntil">, now: Date = new Date()): number {
  // **JST の日付で数える。** `isExpired` と同じ理由——サーバのローカル時刻で
  // 計算すると、UTC のサーバでは**JST の 00:00〜08:59 が前日**になり、
  // 残り日数が 1 日多く出る(2026-08 に修正)。
  const jstMidnight = (d: Date): number =>
    Date.parse(`${new Date(d.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)}T00:00:00.000Z`);
  return Math.round((jstMidnight(new Date(quote.validUntil)) - jstMidnight(now)) / 86_400_000);
}

/**
 * 承認された見積を請求書に変換する。
 *
 * **明細をそのまま引き継ぐ**ので、転記ミスが起きない(手で作り直すと必ずどこかで間違える)。
 *
 * @param quote 見積
 * @param header 請求書番号・支払期日
 * @param rounding 端数処理（**見積と同じ丸め方にすること**。変えると金額がずれます）
 * @returns 請求書
 * @throws {@link @platform/core#AppError} コード `VALIDATION` — **承認されていない見積**を変換しようとした場合
 */
export function convertToInvoice(
  quote: Quote,
  header: { number: string; issueDate: string; dueDate: string; registrationNumber?: string },
  rounding: Rounding = "floor",
): Invoice {
  // **承認されていない見積は変換しない。** 2026-08 まで状態を見ておらず、
  // **却下された見積・下書きからも請求書が作れた**——説明には
  // 「承認されていなければ例外」と書いてあったのに、実装が伴っていなかった。
  // **承認していない金額で請求書を出す**のは、取引先との認識違いに直結する。
  //
  // **`state` を持たない見積は通す**(古いデータ・状態を管理しない運用のため)。
  // 状態を持っているなら `accepted` であることを求める。
  if (quote.state !== undefined && quote.state !== "accepted") {
    throw new AppError(
      ErrorCode.VALIDATION,
      `承認されていない見積は請求書にできません(現在: ${quote.state})`,
    );
  }
  return buildInvoice({ ...header, billTo: quote.billTo }, quote.lines, rounding);
}
