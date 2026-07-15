/**
 * 督促(督促状の段階・文面・送付判定。純ロジック)。
 * 支払期限からの経過日数で督促レベルを決め、日本語の督促文面を組み立てる。
 * @packageDocumentation
 */

/** 督促レベル。 */
export type DunningLevel = "none" | "reminder" | "first" | "second" | "final";

/** レベルごとの経過日数しきい値(この日数を超えたら該当レベル)。 */
export const DUNNING_THRESHOLDS: { level: Exclude<DunningLevel, "none">; minOverdueDays: number }[] = [
  { level: "final", minOverdueDays: 60 },
  { level: "second", minOverdueDays: 30 },
  { level: "first", minOverdueDays: 14 },
  { level: "reminder", minOverdueDays: 1 },
];

/** 経過日数から督促レベルを判定する。 */
export function dunningLevel(overdueDays: number): DunningLevel {
  for (const t of DUNNING_THRESHOLDS) {
    if (overdueDays >= t.minOverdueDays) return t.level;
  }
  return "none";
}

/** 督促レベルの表示名。 */
export const DUNNING_LABELS: Record<DunningLevel, string> = {
  none: "督促なし",
  reminder: "お支払いのご案内",
  first: "お支払いのお願い(第1回)",
  second: "お支払いのお願い(第2回)",
  final: "最終のお支払いのお願い",
};

/** 督促対象の請求書情報。 */
export interface DunningInvoice {
  number: string;
  billTo: string;
  dueDate: string;
  amountDue: number;
}

/** 督促文面(日本語)を組み立てる。 */
export function dunningMessage(invoice: DunningInvoice, level: DunningLevel): string {
  const amount = `¥${invoice.amountDue.toLocaleString("ja-JP")}`;
  const head = `${invoice.billTo} 御中`;
  const base = `請求書番号 ${invoice.number}(支払期限 ${invoice.dueDate}、金額 ${amount})のお支払いを確認できておりません。`;
  const tail: Record<DunningLevel, string> = {
    none: "",
    reminder: "行き違いの際はご容赦ください。ご確認をお願いいたします。",
    first: "お手数ですが、至急ご確認のうえお支払いくださいますようお願い申し上げます。",
    second: "再度のご連絡となります。速やかにお支払いくださいますようお願い申し上げます。",
    final: "本状が最終のご案内です。指定期日までにお支払いなき場合、所定の手続きに移行する場合がございます。",
  };
  return `${head}\n\n${base}${tail[level] ? "\n" + tail[level] : ""}`;
}

/**
 * 督促を送るべきか(未送信のレベルに到達しているか)。
 * @param overdueDays 経過日数
 * @param sentLevels すでに送付済みのレベル
 */
export function shouldSendDunning(overdueDays: number, sentLevels: DunningLevel[] = []): { send: boolean; level: DunningLevel } {
  const level = dunningLevel(overdueDays);
  if (level === "none") return { send: false, level };
  return { send: !sentLevels.includes(level), level };
}
