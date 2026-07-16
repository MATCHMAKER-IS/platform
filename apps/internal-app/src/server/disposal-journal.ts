/**
 * 固定資産の除却・売却の仕訳（アプリ側の組み合わせ）。
 * 除却は「減価償却累計額・固定資産除却損 / 固定資産」、売却は現金と売却損益を計上する。集計は @platform/depreciation に委譲。
 * @packageDocumentation
 */
import { scheduleFor, type FixedAsset } from "./asset-repo";
import { bookValueAt } from "@platform/depreciation";
import { type JournalEntry, type JournalLine } from "@platform/accounting";

/** 除却・売却で使う勘定科目の区分。 */
export const DISPOSAL_ACCOUNT_TYPES: Record<string, "asset" | "liability" | "equity" | "revenue" | "expense"> = {
  固定資産: "asset",
  減価償却累計額: "asset",
  現金預金: "asset",
  固定資産除却損: "expense",
  固定資産売却損: "expense",
  固定資産売却益: "revenue",
};

/** 除却・売却時の帳簿価額（除却年度の前年度末簿価）。 */
export function disposalBookValue(asset: FixedAsset, disposalYear: number): number {
  return bookValueAt(scheduleFor(asset), disposalYear - 1, asset.cost);
}

/** 除却・売却の仕訳を作る（貸借一致）。asset には disposedOn・disposalType・proceeds が必要。 */
export function disposalJournal(asset: FixedAsset & { disposedOn: string; disposalType: "retire" | "sell"; proceeds?: number }): JournalEntry {
  const year = Number(asset.disposedOn.slice(0, 4));
  const bookValue = disposalBookValue(asset, year);
  const accumulated = asset.cost - bookValue;
  const lines: JournalLine[] = [];
  const memo = asset.code;

  if (asset.disposalType === "sell") {
    const proceeds = asset.proceeds ?? 0;
    lines.push({ account: "現金預金", debit: proceeds, credit: 0, memo });
    if (accumulated > 0) lines.push({ account: "減価償却累計額", debit: accumulated, credit: 0, memo });
    const gain = proceeds - bookValue;
    if (gain < 0) lines.push({ account: "固定資産売却損", debit: -gain, credit: 0, memo });
    lines.push({ account: "固定資産", debit: 0, credit: asset.cost, memo });
    if (gain > 0) lines.push({ account: "固定資産売却益", debit: 0, credit: gain, memo });
  } else {
    if (accumulated > 0) lines.push({ account: "減価償却累計額", debit: accumulated, credit: 0, memo });
    if (bookValue > 0) lines.push({ account: "固定資産除却損", debit: bookValue, credit: 0, memo });
    lines.push({ account: "固定資産", debit: 0, credit: asset.cost, memo });
  }

  const label = asset.disposalType === "sell" ? "売却" : "除却";
  return { date: asset.disposedOn, description: `固定資産${label} ${asset.name}`, lines };
}
