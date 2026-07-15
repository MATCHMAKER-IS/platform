/**
 * 通貨・為替ユーティリティ(純)。通貨メタ・端数処理・レート換算・複数通貨合算。
 * 金額は「最小単位の整数」ではなく通常の数値で扱い、端数は通貨の小数桁で丸める。
 * @packageDocumentation
 */

/** 通貨メタデータ。 */
export interface CurrencyMeta { code: string; symbol: string; decimals: number; name: string }

const CURRENCIES: Record<string, CurrencyMeta> = {
  JPY: { code: "JPY", symbol: "¥", decimals: 0, name: "日本円" },
  USD: { code: "USD", symbol: "$", decimals: 2, name: "米ドル" },
  EUR: { code: "EUR", symbol: "€", decimals: 2, name: "ユーロ" },
  GBP: { code: "GBP", symbol: "£", decimals: 2, name: "英ポンド" },
  CNY: { code: "CNY", symbol: "¥", decimals: 2, name: "人民元" },
  KRW: { code: "KRW", symbol: "₩", decimals: 0, name: "韓国ウォン" },
  TWD: { code: "TWD", symbol: "NT$", decimals: 0, name: "台湾ドル" },
  AUD: { code: "AUD", symbol: "A$", decimals: 2, name: "豪ドル" },
  BTC: { code: "BTC", symbol: "₿", decimals: 8, name: "ビットコイン" },
};

/** 通貨メタを取得する(未知は decimals=2 の既定)。 */
export function currencyMeta(code: string): CurrencyMeta {
  return CURRENCIES[code.toUpperCase()] ?? { code: code.toUpperCase(), symbol: code.toUpperCase(), decimals: 2, name: code };
}

/** 通貨の小数桁で丸める(銀行丸め=最近接偶数も選択可)。 */
export function roundMoney(amount: number, code: string, mode: "half-up" | "bankers" = "half-up"): number {
  const { decimals } = currencyMeta(code);
  const factor = Math.pow(10, decimals);
  const scaled = amount * factor;
  if (mode === "bankers") {
    const floor = Math.floor(scaled);
    const diff = scaled - floor;
    let rounded: number;
    if (Math.abs(diff - 0.5) < Number.EPSILON) rounded = floor % 2 === 0 ? floor : floor + 1;
    else rounded = Math.round(scaled);
    return rounded / factor;
  }
  // half-up(誤差回避のため丸め前に微小補正)
  return Math.round((scaled + (scaled >= 0 ? 1 : -1) * 1e-9)) / factor;
}

/** 金額。 */
export interface Money { amount: number; currency: string }

/** 金額を作る(通貨桁で丸め)。 */
export function money(amount: number, currency: string): Money {
  return { amount: roundMoney(amount, currency), currency: currency.toUpperCase() };
}

/** 通貨記号つきで整形する(桁区切りあり)。 */
export function formatMoney(m: Money, options: { symbol?: boolean; code?: boolean } = {}): string {
  const meta = currencyMeta(m.currency);
  const rounded = roundMoney(m.amount, m.currency);
  const s = rounded.toLocaleString("en-US", { minimumFractionDigits: meta.decimals, maximumFractionDigits: meta.decimals });
  const sym = options.symbol === false ? "" : meta.symbol;
  const code = options.code ? ` ${meta.code}` : "";
  return `${sym}${s}${code}`;
}

/** レート換算する(from→to)。rate は「1 from = rate to」。 */
export function convert(m: Money, to: string, rate: number): Money {
  return money(m.amount * rate, to);
}

/** 同一通貨の金額を加算する。通貨が異なれば null。 */
export function addMoney(a: Money, b: Money): Money | null {
  if (a.currency !== b.currency) return null;
  return money(a.amount + b.amount, a.currency);
}

/** 同一通貨の金額配列を合算する。混在は null。空配列は 0。 */
export function sumMoney(items: readonly Money[]): Money | null {
  if (items.length === 0) return { amount: 0, currency: "JPY" };
  const currency = items[0]!.currency;
  if (!items.every((m) => m.currency === currency)) return null;
  return money(items.reduce((acc, m) => acc + m.amount, 0), currency);
}

/** 複数通貨を為替レート表(対基準通貨)で基準通貨に換算して合算する。 */
export function totalInBaseCurrency(items: readonly Money[], baseCurrency: string, rates: Record<string, number>): Money {
  let total = 0;
  for (const m of items) {
    if (m.currency === baseCurrency) total += m.amount;
    else {
      const rate = rates[m.currency];
      if (rate === undefined) continue; // レート無しはスキップ
      total += m.amount * rate;
    }
  }
  return money(total, baseCurrency);
}
