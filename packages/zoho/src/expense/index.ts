/**
 * `@platform/zoho/expense` — Zoho Expense API（v1）クライアント。
 *
 * ベースは `expense.zoho.{dc}/api/v1`。
 *
 * 【`organization_id` が全ての呼び出しに要ります】
 * Zoho Books と同じ仕組みです。**ヘッダではなくクエリ**で渡します——
 * 忘れると **400 で「組織が見つかりません」**になります。
 *
 * 【お金が動くので気をつけること】
 * **承認済みの経費は消せません**（提出前だけ消せます）。
 * 取り消したいなら**却下してから**削除してください。
 *
 * **金額と通貨は必ず組で扱ってください。** 海外出張の経費は
 * 外貨で登録され、**円に直すのは Zoho 側**です——
 * アプリ側で勝手に換算すると**帳簿と合わなくなります**。
 *
 * @packageDocumentation
 */
import type { Result } from "@platform/core";

import { createZohoApiClient } from "../core/client";
import { serviceClientParts, type ZohoDataCenter } from "../core/datacenter";

/** 経費の 1 件。 */
export interface ZohoExpense {
  expense_id?: string;
  /** 日付（`yyyy-MM-dd`）。 */
  date?: string;
  /** 金額。**通貨と組で見てください**。 */
  amount?: number;
  currency_code?: string;
  /** 勘定科目の ID。 */
  account_id?: string;
  account_name?: string;
  /** 状態（`unsubmitted` / `submitted` / `approved` / `reimbursed` など）。 */
  status?: string;
  description?: string;
  /** 領収書が付いているか。 */
  is_receipt_attached?: boolean;
}

/** 経費報告書（複数の経費をまとめて申請する単位）。 */
export interface ZohoExpenseReport {
  report_id?: string;
  report_name?: string;
  status?: string;
  total?: number;
  currency_code?: string;
  /** 提出日。 */
  submitted_date?: string;
}

/** 経費を作るときの入力。 */
export interface ZohoExpenseCreateInput {
  /** 日付（`yyyy-MM-dd`）。**未来の日付は弾かれます**。 */
  date: string;
  /** 金額。 */
  amount: number;
  /** 勘定科目の ID（**先に一覧を引いて選ばせてください**）。 */
  account_id: string;
  /** 通貨（省略時は組織の既定）。 */
  currency_code?: string;
  description?: string;
  /** 顧客に請求する経費か。 */
  is_billable?: boolean;
  /** 紐づける顧客。`is_billable` が真なら**必須**です。 */
  customer_id?: string;
}

/** Zoho Expense のクライアント。 */
export interface ZohoExpenseClient {
  /**
   * 経費を登録する。
   *
   * **領収書は別に添付します**（この呼び出しでは付きません）。
   * **領収書の無い経費は、多くの会社で承認されません**——
   * 登録直後に添付まで進める画面にしてください。
   */
  createExpense(input: ZohoExpenseCreateInput): Promise<Result<{ expense?: ZohoExpense }>>;

  /**
   * 経費の一覧。
   *
   * **既定は 200 件**で、それ以上は `page` をずらします。
   * **状態で絞れます**（`status: "unsubmitted"` で未提出だけ）。
   */
  listExpenses(options?: {
    status?: string;
    page?: number;
    perPage?: number;
    /** `yyyy-MM-dd`。この日以降。 */
    dateAfter?: string;
  }): Promise<Result<{ expenses?: ZohoExpense[] }>>;

  /**
   * 領収書を添付する。
   *
   * **画像か PDF**を渡します。**5MB まで**——
   * スマホで撮った写真はそのままだと超えることがあるので、
   * **縮めてから**送ってください（`@platform/image`）。
   */
  attachReceipt(
    expenseId: string,
    file: Uint8Array,
    filename: string,
    contentType: string,
  ): Promise<Result<unknown>>;

  /** 経費報告書の一覧。 */
  listReports(options?: { status?: string; page?: number }): Promise<Result<{ expense_reports?: ZohoExpenseReport[] }>>;

  /**
   * 経費報告書を提出する。
   *
   * **提出すると本人は編集できなくなります。**
   * 承認者が却下するまで直せないので、**提出前に確認を出して**ください。
   */
  submitReport(reportId: string): Promise<Result<unknown>>;

  /**
   * 承認する。
   *
   * **承認すると消せなくなります**（却下してからでないと削除できません）。
   */
  approveReport(reportId: string): Promise<Result<unknown>>;
}

/**
 * Zoho Expense のクライアントを作る。
 *
 * @param config `accessToken`・`dataCenter`（日本なら `jp`）・`organizationId`
 * @returns Zoho Expense のクライアント
 */
export function createZohoExpenseClient(config: {
  accessToken: string;
  dataCenter: ZohoDataCenter;
  organizationId: string;
  fetchImpl?: typeof fetch;
}): ZohoExpenseClient {
  const api = createZohoApiClient({
    ...serviceClientParts("expense", config.dataCenter),
    accessToken: config.accessToken,
    fetchImpl: config.fetchImpl,
    // **組織 ID は全ての呼び出しに要ります。** ここで既定に入れておけば、
    // **呼ぶたびに書く必要がなく、忘れることもありません**。
    defaultQuery: { organization_id: config.organizationId },
  });
  const enc = (v: string) => encodeURIComponent(v);

  return {
    createExpense: (input) =>
      api.post("/expenses", {
        body: {
          date: input.date,
          amount: input.amount,
          account_id: input.account_id,
          ...(input.currency_code === undefined ? {} : { currency_code: input.currency_code }),
          ...(input.description === undefined ? {} : { description: input.description }),
          ...(input.is_billable === undefined ? {} : { is_billable: input.is_billable }),
          ...(input.customer_id === undefined ? {} : { customer_id: input.customer_id }),
        },
      }),

    listExpenses: (options = {}) =>
      api.get("/expenses", {
        query: {
          page: String(options.page ?? 1),
          per_page: String(Math.min(options.perPage ?? 200, 200)),
          ...(options.status === undefined ? {} : { status: options.status }),
          ...(options.dateAfter === undefined ? {} : { "date.after": options.dateAfter }),
        },
      }),

    attachReceipt: (expenseId, file, filename, contentType) => {
      // **添付は multipart で送ります。** JSON では送れません——
      // ここを間違えると**「不正な形式」で弾かれ、原因が分かりにくい**。
      // **`as BlobPart`。** TypeScript が Uint8Array をジェネリック化して
      // 以降、`BlobPart` との構造的な適合が崩れることがある
      // (2026-08、`pnpm install` 後のユーザー環境で確認)。
      const form = new FormData();
      form.append("receipt", new Blob([file as BlobPart], { type: contentType }), filename);
      return api.post(`/expenses/${enc(expenseId)}/receipt`, { body: form });
    },

    listReports: (options = {}) =>
      api.get("/expensereports", {
        query: {
          page: String(options.page ?? 1),
          ...(options.status === undefined ? {} : { status: options.status }),
        },
      }),

    submitReport: (reportId) =>
      api.post(`/expensereports/${enc(reportId)}/submit`, { body: {} }),

    approveReport: (reportId) =>
      api.post(`/expensereports/${enc(reportId)}/approve`, { body: {} }),
  };
}
