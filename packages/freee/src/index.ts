/**
 * `@platform/freee` — freee 会計 API クライアント。
 *
 * 事業所・取引・取引先・勘定科目に加え、請求書・見積書・経費申請・各種マスタ(部門/品目/
 * メモタグ/税区分)・口座明細・試算表を型付きで扱う。多くのエンドポイントで company_id が必須。
 * OAuth トークンの取得・更新はアプリ側の責務(fetchImpl 注入で耐障害ラッパーと合成可能)。
 * @packageDocumentation
 */
import { createApiClient, type MultipartFile } from "@platform/integrations";
import type { Result } from "@platform/core";

/** 一覧のページング(freee は limit/offset、上限は概ね100)。 */
export interface FreeePaging { limit?: number; offset?: number }

/** freee クライアント。 */
export interface FreeeClient {
  // ── 基本 ──
  /** 認証中ユーザー情報。 */
  getMe(): Promise<Result<unknown>>;
  /** 利用可能な事業所一覧。 */
  getCompanies(): Promise<Result<unknown>>;

  // ── 取引(deals) ──
  /** 取引(収入・支出)一覧。 */
  getDeals(companyId: number, params?: FreeePaging): Promise<Result<unknown>>;
  /** 取引詳細。 */
  getDeal(companyId: number, dealId: number): Promise<Result<unknown>>;
  /** 取引を作成する(body に company_id を含める)。 */
  createDeal(body: Record<string, unknown>): Promise<Result<unknown>>;
  /** 取引を更新する。 */
  updateDeal(dealId: number, body: Record<string, unknown>): Promise<Result<unknown>>;
  /** 取引を削除する。 */
  deleteDeal(companyId: number, dealId: number): Promise<Result<unknown>>;

  // ── 証憑(receipts / ファイルボックス) ──
  /** 証憑ファイル(領収書等)をアップロードする。経費精算での添付に。 */
  uploadReceipt(companyId: number, file: { filename: string; data: Uint8Array | Blob; contentType?: string }, description?: string): Promise<Result<unknown>>;
  /** 証憑一覧を取得する。 */
  getReceipts(companyId: number, p?: { startDate?: string; endDate?: string; limit?: number; offset?: number }): Promise<Result<unknown>>;
  /** 証憑を1件取得する。 */
  getReceipt(companyId: number, receiptId: number): Promise<Result<unknown>>;

  // ── 振替伝票(manual_journals) ──
  /** 振替伝票を作成する。 */
  createManualJournal(body: unknown): Promise<Result<unknown>>;
  /** 振替伝票一覧を取得する。 */
  getManualJournals(companyId: number, p?: FreeePaging): Promise<Result<unknown>>;

  // ── 仕訳帳(journals) ── ※非同期ダウンロード
  /** 仕訳帳のダウンロードを要求する(ダウンロード用 ID を返す)。 */
  requestJournals(companyId: number, p?: { downloadType?: string; startDate?: string; endDate?: string }): Promise<Result<unknown>>;

  // ── 支払(deal payments) ──
  /** 取引に支払行を登録する(入金・出金の消し込み)。 */
  createDealPayment(dealId: number, body: unknown): Promise<Result<unknown>>;

  // ── セグメント / タグ作成 ──
  /** セグメントタグ一覧を取得する。 */
  getSegments(companyId: number, segmentId: number): Promise<Result<unknown>>;
  /** メモタグを作成する。 */
  createTag(body: unknown): Promise<Result<unknown>>;

  // ── 取引先(partners) ──
  /** 取引先一覧。 */
  getPartners(companyId: number, params?: FreeePaging): Promise<Result<unknown>>;
  /** 取引先を作成する。 */
  createPartner(body: Record<string, unknown>): Promise<Result<unknown>>;
  /** 取引先を更新する。 */
  updatePartner(partnerId: number, body: Record<string, unknown>): Promise<Result<unknown>>;

  // ── マスタ ──
  /** 勘定科目一覧。 */
  getAccountItems(companyId: number): Promise<Result<unknown>>;
  /** 部門一覧。 */
  getSections(companyId: number): Promise<Result<unknown>>;
  /** 品目一覧。 */
  getItems(companyId: number): Promise<Result<unknown>>;
  /** メモタグ一覧。 */
  getTags(companyId: number): Promise<Result<unknown>>;
  /** 税区分一覧。 */
  getTaxes(companyId: number): Promise<Result<unknown>>;
  /** 口座(登録済みウォレット)一覧。 */
  getWalletables(companyId: number): Promise<Result<unknown>>;

  // ── 請求書・見積書 ──
  /** 請求書一覧。 */
  getInvoices(companyId: number, params?: FreeePaging): Promise<Result<unknown>>;
  /** 請求書を作成する。 */
  createInvoice(body: Record<string, unknown>): Promise<Result<unknown>>;
  /** 見積書一覧。 */
  getQuotations(companyId: number, params?: FreeePaging): Promise<Result<unknown>>;
  /** 見積書を作成する。 */
  createQuotation(body: Record<string, unknown>): Promise<Result<unknown>>;

  // ── 経費申請(expense_applications) ──
  /** 経費申請一覧。 */
  getExpenseApplications(companyId: number, params?: FreeePaging): Promise<Result<unknown>>;
  /** 経費申請を作成する。 */
  createExpenseApplication(body: Record<string, unknown>): Promise<Result<unknown>>;

  // ── 口座明細・レポート ──
  /** 口座明細(入出金)一覧。 */
  getWalletTxns(companyId: number, params?: FreeePaging & { walletableType?: string; walletableId?: number }): Promise<Result<unknown>>;
  /** 試算表(貸借対照表 bs / 損益計算書 pl)。 */
  getTrialBalance(companyId: number, report: "trial_bs" | "trial_pl", params?: { fiscalYear?: number; startMonth?: number; endMonth?: number }): Promise<Result<unknown>>;

  /** セグメント一覧(セグメント1/2/3 のタグ)。 */
  getSegmentTags(companyId: number, segmentId: 1 | 2 | 3): Promise<Result<unknown>>;

  // ── 承認ワークフロー ──
  /** 経費申請を承認/却下/差戻しする(申請の承認フロー操作)。 */
  actionExpenseApplication(companyId: number, expenseApplicationId: number, action: "approve" | "reject" | "cancel" | "feedback", params?: { approvalStep?: number; comment?: string }): Promise<Result<unknown>>;
  /** 各種申請(承認依頼)の一覧。 */
  getApprovalRequests(companyId: number, params?: FreeePaging & { applicationType?: string }): Promise<Result<unknown>>;
  /** 申請(承認依頼)を承認/却下する。 */
  actionApprovalRequest(companyId: number, approvalRequestId: number, action: "approve" | "reject" | "cancel", params?: { approvalStep?: number; comment?: string }): Promise<Result<unknown>>;
}

/**
 * freee クライアントを作る。
 * @param config `accessToken`(OAuth)と任意の `fetchImpl`(耐障害ラッパー注入・テスト差し替え用)
 * @example
 * ```ts
 * const freee = createFreeeClient({ accessToken });
 * const deals = await freee.getDeals(companyId, { limit: 50 });
 * ```
 * @returns 会計のクライアント。**すべてのメソッドは Result 型を返す**(例外を投げない)
 */
export function createFreeeClient(config: { accessToken: string; fetchImpl?: typeof fetch }): FreeeClient {
  const api = createApiClient({
    baseUrl: "https://api.freee.co.jp/api/1",
    headers: { Authorization: `Bearer ${config.accessToken}` },
    fetchImpl: config.fetchImpl,
  });
  const q = (companyId: number, extra?: Record<string, unknown>) => ({ company_id: companyId, ...(extra ?? {}) });
  return {
    getMe: () => api.get("/users/me"),
    getCompanies: () => api.get("/companies"),

    getDeals: (companyId, p) => api.get("/deals", { query: q(companyId, { limit: p?.limit, offset: p?.offset }) }),
    getDeal: (companyId, dealId) => api.get(`/deals/${dealId}`, { query: q(companyId) }),
    createDeal: (body) => api.post("/deals", { body }),
    updateDeal: (dealId, body) => api.put(`/deals/${dealId}`, { body }),
    deleteDeal: (companyId, dealId) => api.delete(`/deals/${dealId}`, { query: q(companyId) }),

    getPartners: (companyId, p) => api.get("/partners", { query: q(companyId, { limit: p?.limit, offset: p?.offset }) }),
    createPartner: (body) => api.post("/partners", { body }),
    updatePartner: (partnerId, body) => api.put(`/partners/${partnerId}`, { body }),

    getAccountItems: (companyId) => api.get("/account_items", { query: q(companyId) }),
    getSections: (companyId) => api.get("/sections", { query: q(companyId) }),
    getItems: (companyId) => api.get("/items", { query: q(companyId) }),
    getTags: (companyId) => api.get("/tags", { query: q(companyId) }),
    getTaxes: (companyId) => api.get("/taxes/companies/" + companyId, {}),
    getWalletables: (companyId) => api.get("/walletables", { query: q(companyId) }),

    getInvoices: (companyId, p) => api.get("/invoices", { query: q(companyId, { limit: p?.limit, offset: p?.offset }) }),
    createInvoice: (body) => api.post("/invoices", { body }),
    getQuotations: (companyId, p) => api.get("/quotations", { query: q(companyId, { limit: p?.limit, offset: p?.offset }) }),
    createQuotation: (body) => api.post("/quotations", { body }),

    getExpenseApplications: (companyId, p) => api.get("/expense_applications", { query: q(companyId, { limit: p?.limit, offset: p?.offset }) }),
    createExpenseApplication: (body) => api.post("/expense_applications", { body }),

    getWalletTxns: (companyId, p) => api.get("/wallet_txns", { query: q(companyId, { limit: p?.limit, offset: p?.offset, walletable_type: p?.walletableType, walletable_id: p?.walletableId }) }),
    getTrialBalance: (companyId, report, p) => api.get(`/reports/${report}`, { query: q(companyId, { fiscal_year: p?.fiscalYear, start_month: p?.startMonth, end_month: p?.endMonth }) }),

    // 証憑(multipart アップロード)
    uploadReceipt: (companyId, file, description) =>
      api.post("/receipts", { multipart: { fields: { company_id: companyId, ...(description ? { description } : {}) }, files: [{ field: "receipt", filename: file.filename, data: file.data, contentType: file.contentType }] } }),
    getReceipts: (companyId, p) => api.get("/receipts", { query: q(companyId, { start_date: p?.startDate, end_date: p?.endDate, limit: p?.limit, offset: p?.offset }) }),
    getReceipt: (companyId, receiptId) => api.get(`/receipts/${receiptId}`, { query: q(companyId) }),

    // 振替伝票
    createManualJournal: (body) => api.post("/manual_journals", { body }),
    getManualJournals: (companyId, p) => api.get("/manual_journals", { query: q(companyId, { limit: p?.limit, offset: p?.offset }) }),

    // 仕訳帳(非同期ダウンロード要求)
    requestJournals: (companyId, p) => api.get("/journals", { query: q(companyId, { download_type: p?.downloadType ?? "csv", start_date: p?.startDate, end_date: p?.endDate }) }),

    // 支払
    createDealPayment: (dealId, body) => api.post(`/deals/${dealId}/payments`, { body }),

    // セグメント / タグ
    getSegments: (companyId, segmentId) => api.get(`/segments/${segmentId}/tags`, { query: q(companyId) }),
    createTag: (body) => api.post("/tags", { body }),
    getSegmentTags: (companyId, segmentId) => api.get(`/segments/${segmentId}/tags`, { query: q(companyId) }),

    actionExpenseApplication: (companyId, expenseApplicationId, action, p) =>
      api.post(`/expense_applications/${expenseApplicationId}/actions`, { body: { company_id: companyId, action, ...(p?.approvalStep !== undefined ? { approval_step_id: p.approvalStep } : {}), ...(p?.comment ? { comment: p.comment } : {}) } }),
    getApprovalRequests: (companyId, p) =>
      api.get("/approval_requests", { query: q(companyId, { limit: p?.limit, offset: p?.offset, application_type: p?.applicationType }) }),
    actionApprovalRequest: (companyId, approvalRequestId, action, p) =>
      api.post(`/approval_requests/${approvalRequestId}/actions`, { body: { company_id: companyId, action, ...(p?.approvalStep !== undefined ? { approval_step_id: p.approvalStep } : {}), ...(p?.comment ? { comment: p.comment } : {}) } }),
  };
}

/**
 * ページングを辿って全件取得する補助(freee は limit/offset)。
 * @param fetchPage offset を受けて1ページ取得する関数(Result を返す)
 * @param extract レスポンスから配列を取り出す関数
 * @param pageSize 1ページ件数(既定 100)
 * @param maxPages 安全上限(既定 50)
 * @returns 全ページを結合した配列。**件数が多いと時間もメモリも食う**(freee は 1 ページ 100 件が上限)
 */
export async function fetchAllPages<T>(
  fetchPage: (paging: FreeePaging) => Promise<Result<unknown>>,
  extract: (response: unknown) => T[],
  pageSize = 100,
  maxPages = 50,
): Promise<Result<T[]>> {
  const all: T[] = [];
  for (let page = 0; page < maxPages; page++) {
    const res = await fetchPage({ limit: pageSize, offset: page * pageSize });
    if (!res.ok) return res;
    const items = extract(res.value);
    all.push(...items);
    if (items.length < pageSize) break; // 最終ページ
  }
  return { ok: true, value: all };
}

export * from "./token";
export * from "./webhook";
export * from "./hr";
export * from "./builders";
