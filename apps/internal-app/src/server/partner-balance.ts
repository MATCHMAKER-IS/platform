/**
 * 取引先ごとの債権債務残高（アプリ側の組み合わせ）。取引先マスタを軸に、
 * 未回収の請求（売掛）と未払の発注（買掛）を名寄せして残高を出す。純粋な組み立てのみ。
 * @packageDocumentation
 */

/** 残高計算に使う請求（billTo と未回収残）。 */
export interface BalanceInvoice { billTo: string; balance: number; }
/** 残高計算に使う発注（supplier と未払残）。 */
export interface BalanceOrder { supplier: string; balance: number; }

/** 取引先の債権債務残高。 */
export interface PartnerBalance {
  code: string;
  name: string;
  /** 売掛残（未回収）。 */
  receivable: number;
  /** 買掛残（未払）。 */
  payable: number;
  /** 差引（売掛 − 買掛）。 */
  net: number;
}

/** 取引先名で売掛・買掛残を集計する。 */
export function partnerBalance(name: string, invoices: BalanceInvoice[], orders: BalanceOrder[]): { receivable: number; payable: number; net: number } {
  const receivable = invoices.filter((i) => i.billTo === name).reduce((s, i) => s + Math.max(0, i.balance), 0);
  const payable = orders.filter((o) => o.supplier === name).reduce((s, o) => s + Math.max(0, o.balance), 0);
  return { receivable, payable, net: receivable - payable };
}

/** 取引先マスタ全件の残高一覧を作る。 */
export function partnerBalances(partners: { code: string; name: string }[], invoices: BalanceInvoice[], orders: BalanceOrder[]): PartnerBalance[] {
  return partners.map((p) => {
    const b = partnerBalance(p.name, invoices, orders);
    return { code: p.code, name: p.name, receivable: b.receivable, payable: b.payable, net: b.net };
  });
}

/** 残高一覧の合計。 */
export function totalBalances(balances: PartnerBalance[]): { receivable: number; payable: number; net: number } {
  return {
    receivable: balances.reduce((s, b) => s + b.receivable, 0),
    payable: balances.reduce((s, b) => s + b.payable, 0),
    net: balances.reduce((s, b) => s + b.net, 0),
  };
}
