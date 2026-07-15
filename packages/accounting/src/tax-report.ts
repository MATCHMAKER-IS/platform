/**
 * 消費税集計表(純ロジック)。税率区分ごとの課税売上・仮受消費税、課税仕入・仮払消費税、
 * および差引の納付税額を集計する。金額は請求(@platform/invoice)の税率別集計から渡す。
 * @packageDocumentation
 */

/** 税率別の金額(税抜と消費税)。 */
export interface RateAmount {
  /** 税率(10 / 8 / 0)。 */
  rate: number;
  /** 税抜額。 */
  net: number;
  /** 消費税額。 */
  tax: number;
}

/** 税率別の集計行。 */
export interface TaxReportRow {
  rate: number;
  salesNet: number;
  outputTax: number;   // 仮受消費税
  purchaseNet: number;
  inputTax: number;    // 仮払消費税
}

/** 消費税集計表。 */
export interface TaxReport {
  byRate: TaxReportRow[];
  /** 仮受消費税合計。 */
  outputTax: number;
  /** 仮払消費税合計。 */
  inputTax: number;
  /** 納付税額(仮受 − 仮払。マイナスは還付)。 */
  netPayable: number;
}

function sumByRate(items: RateAmount[]): Map<number, { net: number; tax: number }> {
  const map = new Map<number, { net: number; tax: number }>();
  for (const it of items) {
    const cur = map.get(it.rate) ?? { net: 0, tax: 0 };
    cur.net += it.net;
    cur.tax += it.tax;
    map.set(it.rate, cur);
  }
  return map;
}

/** 課税売上・課税仕入(いずれも税率別)から消費税集計表を作る。 */
export function consumptionTaxSummary(sales: RateAmount[], purchases: RateAmount[]): TaxReport {
  const s = sumByRate(sales);
  const p = sumByRate(purchases);
  const rates = Array.from(new Set([...s.keys(), ...p.keys()])).sort((a, b) => b - a);
  const byRate: TaxReportRow[] = rates.map((rate) => {
    const sv = s.get(rate) ?? { net: 0, tax: 0 };
    const pv = p.get(rate) ?? { net: 0, tax: 0 };
    return { rate, salesNet: sv.net, outputTax: sv.tax, purchaseNet: pv.net, inputTax: pv.tax };
  });
  const outputTax = byRate.reduce((sum, r) => sum + r.outputTax, 0);
  const inputTax = byRate.reduce((sum, r) => sum + r.inputTax, 0);
  return { byRate, outputTax, inputTax, netPayable: outputTax - inputTax };
}
