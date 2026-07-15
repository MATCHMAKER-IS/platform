/**
 * 取引先の活動集約（取引先カルテ）。取引先マスタを軸に、請求・発注・報酬支払の各記録を名寄せして束ねる。
 * これにより取引先マスタが各業務の参照点になる。純粋な組み立てのみ。
 * @packageDocumentation
 */

/** 名寄せ対象のレコード。 */
export interface LinkInvoice { number: string; issueDate: string; billTo: string; total: number; }
export interface LinkOrder { number: string; orderDate: string; supplier: string; total: number; }
export interface LinkFeePayment { payee: string; category: string; base: number; withholding: number; paidAt: string; }

/** 取引先の活動サマリー。 */
export interface PartnerActivity {
  invoices: LinkInvoice[];
  orders: LinkOrder[];
  feePayments: LinkFeePayment[];
  totalBilled: number;
  totalOrdered: number;
  totalPaid: number;
}

/**
 * 取引先名で請求・発注・報酬支払を名寄せし、活動サマリーを作る。
 * @param name 取引先名（請求の billTo・発注の supplier・報酬の payee と突合）。
 */
export function partnerActivity(name: string, invoices: LinkInvoice[], orders: LinkOrder[], feePayments: LinkFeePayment[]): PartnerActivity {
  const inv = invoices.filter((i) => i.billTo === name);
  const ord = orders.filter((o) => o.supplier === name);
  const fee = feePayments.filter((f) => f.payee === name);
  return {
    invoices: inv,
    orders: ord,
    feePayments: fee,
    totalBilled: inv.reduce((s, i) => s + i.total, 0),
    totalOrdered: ord.reduce((s, o) => s + o.total, 0),
    totalPaid: fee.reduce((s, f) => s + f.base, 0),
  };
}
