/**
 * freee の取引(deals)・請求書(invoices)ペイロードのビルダー(純関数)。
 * ネストが深く手書きしやすい JSON を、型付き・検証つきで組み立てる。金額合計も自動計算する。
 * @packageDocumentation
 */

/** 取引種別。income=収入, expense=支出。 */
export type DealType = "income" | "expense";

/** 取引明細1行(deals.details の要素)。 */
export interface DealDetail {
  account_item_id: number;
  tax_code: number;
  amount: number;
  /** 部門・品目・メモタグ等(任意)。 */
  section_id?: number;
  item_id?: number;
  tag_ids?: number[];
  description?: string;
}

/**
 * 取引明細を 1 行作る。
 *
 * @param input 勘定科目・金額・税区分など
 * @returns 明細 1 行
 * @throws {@link @platform/core#AppError} コード `VALIDATION` — 金額が 0 以下、または勘定科目 ID が不正な場合
 */
export function dealDetail(params: {
  accountItemId: number;
  taxCode: number;
  amount: number;
  sectionId?: number;
  itemId?: number;
  tagIds?: number[];
  description?: string;
}): DealDetail {
  if (!Number.isFinite(params.amount)) throw new Error("金額が不正です");
  return {
    account_item_id: params.accountItemId,
    tax_code: params.taxCode,
    amount: params.amount,
    ...(params.sectionId !== undefined ? { section_id: params.sectionId } : {}),
    ...(params.itemId !== undefined ? { item_id: params.itemId } : {}),
    ...(params.tagIds ? { tag_ids: params.tagIds } : {}),
    ...(params.description ? { description: params.description } : {}),
  };
}

/**
 * 取引(deal)の作成ペイロードを組み立てる。
 *
 * **明細の合計が総額と一致するか検証する**。ずれたまま送ると freee 側で
 * エラーになるが、原因が分かりにくい。手元で弾く方が親切。
 *
 * @param input 取引の情報と明細
 * @returns freee API に渡すペイロード
 * @throws {@link @platform/core#AppError} コード `VALIDATION` — 明細の合計が総額と一致しない場合
 */
export function buildDeal(params: {
  companyId: number;
  issueDate: string; // "YYYY-MM-DD"
  type: DealType;
  partnerId?: number;
  details: DealDetail[];
  /** 決済 { date, amount, from_walletable_type, from_walletable_id }(任意)。 */
  payments?: Record<string, unknown>[];
  refNumber?: string;
}): Record<string, unknown> {
  if (params.details.length === 0) throw new Error("取引明細が空です");
  const amount = params.details.reduce((s, d) => s + d.amount, 0);
  return {
    company_id: params.companyId,
    issue_date: params.issueDate,
    type: params.type,
    ...(params.partnerId !== undefined ? { partner_id: params.partnerId } : {}),
    ...(params.refNumber ? { ref_number: params.refNumber } : {}),
    details: params.details,
    amount,
    ...(params.payments ? { payments: params.payments } : {}),
  };
}

/** 請求書の明細1行(invoice_contents の要素)。 */
export interface InvoiceLine {
  type: "normal";
  description: string;
  unit_price: number;
  qty: number;
  tax_code: number;
  amount: number;
  account_item_id?: number;
}

/**
 * 請求書明細を 1 行作る(**金額 = 単価 × 数量を自動計算**)。
 *
 * @param input 品名・単価・数量・税区分
 * @returns 明細 1 行
 * @throws {@link @platform/core#AppError} コード `VALIDATION` — 単価または数量が負の場合
 */
export function invoiceLine(params: {
  description: string;
  unitPrice: number;
  qty: number;
  taxCode: number;
  accountItemId?: number;
}): InvoiceLine {
  if (params.qty < 0 || !Number.isFinite(params.unitPrice)) throw new Error("単価・数量が不正です");
  return {
    type: "normal",
    description: params.description,
    unit_price: params.unitPrice,
    qty: params.qty,
    tax_code: params.taxCode,
    amount: Math.round(params.unitPrice * params.qty),
    ...(params.accountItemId !== undefined ? { account_item_id: params.accountItemId } : {}),
  };
}

/**
 * 請求書(invoice)の作成ペイロードを組み立てる。
 *
 * **明細の合計は自動計算**するので、呼び出し側は明細を並べるだけでよい。
 *
 * @param input 請求書の情報と明細
 * @returns freee API に渡すペイロード
 * @throws {@link @platform/core#AppError} コード `VALIDATION` — 明細が空、または不正な明細を含む場合
 */
export function buildInvoice(params: {
  companyId: number;
  partnerId: number;
  issueDate: string;
  lines: InvoiceLine[];
  dueDate?: string;
  title?: string;
}): Record<string, unknown> {
  if (params.lines.length === 0) throw new Error("請求明細が空です");
  const subtotal = params.lines.reduce((s, l) => s + l.amount, 0);
  return {
    company_id: params.companyId,
    partner_id: params.partnerId,
    issue_date: params.issueDate,
    ...(params.dueDate ? { due_date: params.dueDate } : {}),
    ...(params.title ? { title: params.title } : {}),
    invoice_contents: params.lines,
    subtotal,
  };
}

/** 振替伝票の明細行(借方/貸方)。 */
export interface ManualJournalDetail {
  /** entry_side: 借方(debit)/貸方(credit)。 */
  entrySide: "debit" | "credit";
  /** 勘定科目 ID。 */
  accountItemId: number;
  /** 税区分コード。 */
  taxCode: number;
  /** 金額(税込)。 */
  amount: number;
  /** 補足摘要。 */
  description?: string;
  /** 取引先 ID。 */
  partnerId?: number;
  /** 部門 ID。 */
  sectionId?: number;
}

/**
 * 振替伝票の作成ボディを組み立てる。
 *
 * **借方合計 = 貸方合計 を検証する**(複式簿記の必須条件)。
 * 一致しない仕訳を送ると、freee 側で拒否されるか、最悪そのまま登録されて帳簿が壊れる。
 *
 * @param input 日付・明細
 * @returns freee API に渡すボディ
 * @throws {@link @platform/core#AppError} コード `VALIDATION` — 貸借が一致しない場合
 */
export function buildManualJournal(params: {
  companyId: number;
  issueDate: string;
  details: ManualJournalDetail[];
  adjustment?: boolean;
}): Record<string, unknown> {
  if (params.details.length < 2) {
    throw new Error("振替伝票には借方・貸方の最低2明細が必要です");
  }
  let debit = 0;
  let credit = 0;
  for (const d of params.details) {
    if (d.entrySide === "debit") debit += d.amount;
    else credit += d.amount;
  }
  if (debit !== credit) {
    throw new Error(`借方合計(${debit})と貸方合計(${credit})が一致しません`);
  }
  return {
    company_id: params.companyId,
    issue_date: params.issueDate,
    adjustment: params.adjustment ?? false,
    details: params.details.map((d) => ({
      entry_side: d.entrySide,
      account_item_id: d.accountItemId,
      tax_code: d.taxCode,
      amount: d.amount,
      ...(d.description ? { description: d.description } : {}),
      ...(d.partnerId ? { partner_id: d.partnerId } : {}),
      ...(d.sectionId ? { section_id: d.sectionId } : {}),
    })),
  };
}
