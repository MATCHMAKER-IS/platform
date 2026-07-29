/**
 * 見本データ。
 *
 * freee の鍵が無い環境でも**画面の作りと使い勝手を確かめられる**ようにします。
 * 数字は実在の企業のものではありません。
 * @packageDocumentation
 */
import type { FreeeWalletable, FreeeWalletTxn } from "@platform/freee";

/** 見本の口座（銀行 2 つ・カード 1 つ・現金）。 */
export const SAMPLE_WALLETS: FreeeWalletable[] = [
  { id: 1, name: "みずほ銀行 当座", type: "bank_account", last_balance: 4_820_000 },
  { id: 2, name: "楽天銀行 普通", type: "bank_account", last_balance: 1_260_000 },
  { id: 3, name: "法人カード", type: "credit_card", last_balance: -380_000 },
  { id: 4, name: "小口現金", type: "wallet", walletable_balance: 52_000 },
];

/** 日付を進める。 */
function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * 見本の明細を作る。
 *
 * **月末に入金・25 日に給与・随時に経費**という、実際にありがちな動きにしてあります。
 * 平坦なデータだと、グラフの意味が分かりません。
 *
 * @param from 開始日
 * @param days 日数
 * @returns 明細
 */
export function sampleTxns(from: string, days: number): FreeeWalletTxn[] {
  const out: FreeeWalletTxn[] = [];
  let id = 1;
  for (let i = 0; i < days; i += 1) {
    const date = addDays(from, i);
    const day = Number(date.slice(8, 10));

    // 月末に売上の入金
    if (day >= 28) {
      out.push({ id: id++, walletable_id: 1, walletable_type: "bank_account", date,
        amount: 2_400_000, entry_side: "income", description: "売上入金" });
    }
    // 25 日に給与
    if (day === 25) {
      out.push({ id: id++, walletable_id: 1, walletable_type: "bank_account", date,
        amount: 1_850_000, entry_side: "expense", description: "給与支払" });
    }
    // 10 日に家賃
    if (day === 10) {
      out.push({ id: id++, walletable_id: 1, walletable_type: "bank_account", date,
        amount: 480_000, entry_side: "expense", description: "家賃" });
    }
    // 平日に細かい経費
    if (i % 3 === 0) {
      out.push({ id: id++, walletable_id: 2, walletable_type: "bank_account", date,
        amount: 30_000 + (i % 7) * 9_000, entry_side: "expense", description: "諸経費" });
    }
  }
  return out;
}
