/**
 * 固定資産の減価償却を会計仕訳に起こす（アプリ側の組み合わせ）。
 * 当年の償却額を「借）減価償却費 / 貸）減価償却累計額」で計上し、決算（P&L・B/S）へ反映する。
 * @packageDocumentation
 */
import { viewOf, type FixedAsset } from "./asset-repo";
import { type JournalEntry } from "@platform/accounting";

/** 減価償却費 = 費用、減価償却累計額 = 資産のマイナス（貸方残の評価勘定）。 */
export const DEPRECIATION_ACCOUNT_TYPES: Record<string, "asset" | "liability" | "equity" | "revenue" | "expense"> = {
  減価償却費: "expense",
  減価償却累計額: "asset",
};

/** 資産台帳から指定年度の減価償却仕訳を作る（当年償却が 0 の資産は除外）。 */
export function depreciationJournal(assets: FixedAsset[], year: number): JournalEntry[] {
  return assets
    .map((a) => viewOf(a, year))
    .filter((v) => v.currentYearDepreciation > 0)
    .map((v) => ({
      date: `${year}-12-31`,
      description: `減価償却 ${v.name}`,
      lines: [
        { account: "減価償却費", debit: v.currentYearDepreciation, credit: 0, memo: v.code },
        { account: "減価償却累計額", debit: 0, credit: v.currentYearDepreciation, memo: v.code },
      ],
    }));
}

/** 当年の減価償却費の合計。 */
export function depreciationTotal(assets: FixedAsset[], year: number): number {
  return assets.map((a) => viewOf(a, year)).reduce((s, v) => s + v.currentYearDepreciation, 0);
}
