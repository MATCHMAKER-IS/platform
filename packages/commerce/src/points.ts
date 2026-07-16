/**
 * ポイント(ロイヤルティ)の計算(純ロジック)。
 * 購入額からの付与、残高計算、利用(充当)、有効期限切れの抽出。日本の EC で一般的。
 * @packageDocumentation
 */

/** ポイント取引(付与 or 利用)。 */
export interface PointTransaction {
  /** 正=付与, 負=利用。 */
  amount: number;
  /** 発生日時(ISO 8601)。 */
  date: string;
  /** 失効日時(付与ポイントのみ・ISO 8601)。 */
  expiresAt?: string;
}

/**
 * 購入額からポイントを計算する。
 *
 * **端数は切り捨て**(切り上げると、店側が損をする)。
 *
 * @param amount 購入額
 * @param rate 還元率(既定 0.01 = 1%)
 * @returns ポイント数
 */
export function earnPoints(purchaseAmount: number, rate = 0.01): number {
  return Math.floor(Math.max(0, purchaseAmount) * rate);
}

/**
 * ポイント残高を計算する。
 *
 * **残高を直接持たず、履歴から計算する**(「なぜこの残高なのか」を追える)。
 * **失効も考慮する**(期限切れのポイントは使えない)。
 *
 * @param transactions 取引履歴
 * @param now 基準日(テスト注入用)
 * @returns 現在の残高
 */
export function pointsBalance(transactions: PointTransaction[], now: Date = new Date()): number {
  const nowMs = now.getTime();
  let balance = 0;
  for (const tx of transactions) {
    // 失効した付与は残高に含めない
    if (tx.amount > 0 && tx.expiresAt && new Date(tx.expiresAt).getTime() <= nowMs) continue;
    balance += tx.amount;
  }
  return Math.max(0, balance);
}

/** ポイント利用の結果。 */
export interface RedeemResult {
  ok: boolean;
  /** 実際に利用したポイント。 */
  used: number;
  /** 利用後の残高。 */
  remaining: number;
}

/**
 * ポイントを利用する(残高を上限に、注文額も上限に)。
 * @param requested 利用したいポイント
 * @param orderAmount 注文額(これを超えるポイントは使えない)
 * @returns 使用後の取引履歴。**残高を超えて使えない**
 */
export function redeemPoints(balance: number, requested: number, orderAmount?: number): RedeemResult {
  const cap = orderAmount !== undefined ? Math.min(balance, orderAmount) : balance;
  const used = Math.max(0, Math.min(requested, cap));
  return { ok: used > 0, used, remaining: balance - used };
}

/**
 * まもなく失効するポイントを返す。
 *
 * **「もうすぐ 500 ポイント失効します」と知らせる**のに使う(黙って消すと
 * 不信感につながる)。**概算**(先入先出で消費したと仮定)。
 *
 * @param transactions 取引履歴
 * @param until この日までに失効する分
 * @param now 基準日(テスト注入用)
 * @returns 失効するポイント数
 */
export function expiringPoints(transactions: PointTransaction[], before: Date, now: Date = new Date()): number {
  const nowMs = now.getTime();
  const beforeMs = before.getTime();
  let expiring = 0;
  for (const tx of transactions) {
    if (tx.amount <= 0 || !tx.expiresAt) continue;
    const exp = new Date(tx.expiresAt).getTime();
    if (exp > nowMs && exp <= beforeMs) expiring += tx.amount;
  }
  return expiring;
}
