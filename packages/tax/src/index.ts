/**
 * `@platform/tax` — 日本の消費税・インボイス(適格請求書)ユーティリティ(純関数)。
 *
 * 税込/税抜変換、軽減税率(8%)と標準税率(10%)の混在、端数処理の選択、
 * 税率別の集計(適格請求書の要件)、登録番号(T+13桁)の検証を提供する。
 * 金額は円(整数前提だが小数も可)で扱い、端数処理は明示的に選ぶ。
 * @packageDocumentation
 */

/** 消費税率。標準10%・軽減8%・非課税/対象外0%。 */
export type TaxRate = 10 | 8 | 0;

/** 端数処理の方法。 */
export type Rounding = "floor" | "round" | "ceil";

/**
 * 端数処理を適用する。
 *
 * @param value    処理する値(小数を含みうる)
 * @param rounding 方法。`floor` 切り捨て / `round` 四捨五入 / `ceil` 切り上げ
 * @returns 整数に丸めた値
 */
export function applyRounding(value: number, rounding: Rounding): number {
  if (rounding === "floor") return Math.floor(value);
  if (rounding === "ceil") return Math.ceil(value);
  return Math.round(value);
}

/**
 * 税抜金額から消費税額を計算する。
 * @param netAmount 税抜金額
 * @param rate 税率(既定 10)
 * @param rounding 端数処理(既定 floor=切り捨て。日本の商習慣で一般的)
 * @returns 消費税額(円)
 *
 * @example
 * ```ts
 * taxAmount(1000);        // => 100(10%)
 * taxAmount(1000, 8);     // => 80(軽減税率)
 * ```
 */
export function taxAmount(netAmount: number, rate: TaxRate = 10, rounding: Rounding = "floor"): number {
  return applyRounding((netAmount * rate) / 100, rounding);
}

/**
 * 税抜 → 税込。
 *
 * @param netAmount 税抜金額(円)
 * @param rate      税率(既定 10)
 * @param rounding  端数処理(既定 floor)
 * @returns 税込金額(円)
 */
export function grossFromNet(netAmount: number, rate: TaxRate = 10, rounding: Rounding = "floor"): number {
  return netAmount + taxAmount(netAmount, rate, rounding);
}

/**
 * 税込 → 税抜(内税から本体価格を逆算)。
 *
 * **整数演算寄りの式**(`gross * 100 / (100 + rate)`)を使い、浮動小数点誤差を避ける。
 *
 * @param grossAmount 税込金額(円)
 * @param rate        税率(既定 10)
 * @param rounding    端数処理(既定 floor)
 * @returns 税抜金額(円)
 *
 * @example
 * ```ts
 * netFromGross(1100);      // => 1000
 * netFromGross(1080, 8);   // => 1000(軽減税率)
 * ```
 */
export function netFromGross(grossAmount: number, rate: TaxRate = 10, rounding: Rounding = "floor"): number {
  if (rate === 0) return grossAmount;
  return applyRounding((grossAmount * 100) / (100 + rate), rounding);
}

/**
 * 税込 → 内税額(税込金額に含まれる消費税)。
 *
 * @param grossAmount 税込金額(円)
 * @param rate        税率(既定 10)
 * @param rounding    端数処理(既定 floor)
 * @returns 内税額(円)
 */
export function taxFromGross(grossAmount: number, rate: TaxRate = 10, rounding: Rounding = "floor"): number {
  return grossAmount - netFromGross(grossAmount, rate, rounding);
}

/** 明細1行(税率つき)。 */
export interface TaxLine {
  /** 税抜金額(税抜計算の場合)。 */
  net?: number;
  /** 税込金額(税込計算の場合)。net か gross のどちらかを指定。 */
  gross?: number;
  rate: TaxRate;
}

/** 税率ごとの集計結果。 */
export interface TaxSubtotal {
  rate: TaxRate;
  net: number;
  tax: number;
  gross: number;
}

/** 請求書全体の税集計(適格請求書の要件: 税率ごとに区分)。 */
export interface TaxSummary {
  /** 税率別の内訳(適格請求書に必須)。 */
  byRate: TaxSubtotal[];
  net: number;
  tax: number;
  gross: number;
}

/**
 * 明細群を税率ごとに集計する(適格請求書の「税率ごとに区分した消費税額」に対応)。
 * 消費税は税率区分ごとに1回だけ端数処理する(明細ごとではなく合計で丸めるのがインボイス要件)。
 * @param lines 明細(net または gross のいずれかを rate とともに)
 * @param rounding 端数処理(既定 floor)
 * @returns 税率別の内訳と合計(適格請求書に必要な「税率ごとの区分記載」を満たす形)
 *
 * @example
 * ```ts
 * summarizeTax([
 *   { net: 1000, rate: 10 },
 *   { net: 500, rate: 8 },
 * ]);
 * // => { byRate: [{rate:10, net:1000, tax:100, gross:1100}, {rate:8, ...}], totalNet: 1500, ... }
 * ```
 */
export function summarizeTax(lines: TaxLine[], rounding: Rounding = "floor"): TaxSummary {
  const rates: TaxRate[] = [10, 8, 0];
  const byRate: TaxSubtotal[] = [];
  for (const rate of rates) {
    const group = lines.filter((l) => l.rate === rate);
    if (group.length === 0) continue;
    // まず税抜合計を出す(gross 指定の行は税抜へ戻す)
    let net = 0;
    for (const l of group) {
      if (l.net !== undefined) net += l.net;
      else if (l.gross !== undefined) net += netFromGross(l.gross, rate, rounding);
    }
    const tax = taxAmount(net, rate, rounding); // 税率区分ごとに1回だけ丸める
    byRate.push({ rate, net, tax, gross: net + tax });
  }
  const net = byRate.reduce((s, r) => s + r.net, 0);
  const tax = byRate.reduce((s, r) => s + r.tax, 0);
  return { byRate, net, tax, gross: net + tax };
}

// ─────────────────────────── インボイス登録番号 ───────────────────────────

/**
 * 適格請求書発行事業者の登録番号(T + 法人番号13桁)を検証する。
 * 法人番号のチェックディジット(モジュラス9)も検証する。
 * @param registrationNumber 例 "T1234567890123"
 * @returns 形式とチェックディジットの両方が正しければ true
 */
export function isValidInvoiceNumber(registrationNumber: string): boolean {
  const m = /^T(\d{13})$/.exec(registrationNumber.trim());
  if (!m) return false;
  return isValidCorporateNumber(m[1]!);
}

/**
 * 法人番号(13桁)のチェックディジットを検証する。
 * 検査用数字 = 9 - (Σ(下位から各桁 × 重み[1,2,1,2...]) mod 9)。先頭桁が検査用数字。
 *
 * @param corporateNumber 13 桁の法人番号(例 "1180301018771")
 * @returns 桁数とチェックディジットが正しければ true
 */
export function isValidCorporateNumber(corporateNumber: string): boolean {
  if (!/^\d{13}$/.test(corporateNumber)) return false;
  const checkDigit = Number(corporateNumber[0]);
  const body = corporateNumber.slice(1); // 残り12桁
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = Number(body[11 - i]); // 下位の桁から
    const weight = i % 2 === 0 ? 1 : 2;
    sum += digit * weight;
  }
  const expected = 9 - (sum % 9);
  return checkDigit === expected;
}

/**
 * 登録番号を正規化する(全角 → 半角・空白除去・大文字化)。
 *
 * 人が手入力した値は全角や空白が混ざるため、検証の前に通す。
 *
 * @param input 入力された登録番号(例 "ｔ　1234567890123")
 * @returns 正規化した文字列(例 "T1234567890123")
 */
export function normalizeInvoiceNumber(input: string): string {
  return input.replace(/[Ｔ]/g, "T").replace(/[０-９]/g, (c) => String(c.charCodeAt(0) - 0xff10)).replace(/\s/g, "").toUpperCase();
}
export * from "./withholding";
