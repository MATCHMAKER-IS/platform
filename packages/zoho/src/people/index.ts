/**
 * `@platform/zoho/people` — Zoho People API クライアント。
 * ベースは `people.zoho.{dc}/people/api`。フォーム(従業員/休暇/勤怠)ベース。
 *
 * 【ページングの注意】
 *
 * **オフセット方式なので、取得中にレコードが増減すると重複・欠落が起きる。**
 * 1 ページ目を取った後に 1 件追加されると全体が 1 つずれ、**同じレコードを再取得**する。
 * 削除された場合は逆に **1 件飛ばす**——件数だけ合っていても中身が違いうる。
 *
 * CRM は `page_token`(カーソル方式)なので起きないが、こちらは避けられない。
 * **一括同期は業務時間外に回すこと**。日中に回すなら、
 * **取得後に ID の重複を除く**(件数ではなく ID で突き合わせる)。
 * @packageDocumentation
 */
import type { Result } from "@platform/core";
import { createZohoApiClient } from "../core/client";
import { serviceBaseUrl, type ZohoDataCenter } from "../core/datacenter";

/** People レスポンス(緩め)。 */
export type PeopleRecord = Record<string, unknown>;

/** People クライアント設定。 */
export interface ZohoPeopleConfig {
  dataCenter: ZohoDataCenter;
  accessToken: string;
  fetchImpl?: typeof fetch;
}

/** People クライアント。 */
export interface ZohoPeopleClient {
  /** フォームのレコード一覧を取得(汎用)。 */
  getFormRecords(formName: string, params?: { sIndex?: number; limit?: number; searchColumn?: string; searchValue?: string }): Promise<Result<PeopleRecord>>;
  /** フォームにレコードを追加(汎用)。 */
  addFormRecord(formName: string, inputData: Record<string, unknown>): Promise<Result<PeopleRecord>>;
  /** フォームのレコードを更新。 */
  updateFormRecord(formName: string, recordId: string, inputData: Record<string, unknown>): Promise<Result<PeopleRecord>>;
  /** 従業員一覧(Employee フォーム)。 */
  getEmployees(params?: { sIndex?: number; limit?: number }): Promise<Result<PeopleRecord>>;
  /** 休暇申請を追加(Leave フォーム)。 */
  addLeave(inputData: Record<string, unknown>): Promise<Result<PeopleRecord>>;
  /** 出退勤の打刻(check-in/out)。 */
  attendanceCheckIn(params: { empId?: string; dateTime: string; checkIn: boolean }): Promise<Result<PeopleRecord>>;
}

/**
 * Zoho People(人事・勤怠)のクライアントを作る。
 *
 * @param config.dataCenter データセンター(**契約時の DC を指定**。間違えると 404 になる)
 * @param config.accessToken アクセストークン(有効期限切れは呼び出し側で更新する)
 * @param config.fetchImpl fetch の実装(テスト注入用)
 * @returns People のクライアント。**すべてのメソッドは Result 型を返す**(例外を投げない)
 */
export function createZohoPeopleClient(config: ZohoPeopleConfig): ZohoPeopleClient {
  const api = createZohoApiClient({
    apiDomain: serviceBaseUrl("people", config.dataCenter),
    basePath: "",
    accessToken: config.accessToken,
    fetchImpl: config.fetchImpl,
  });
  const enc = encodeURIComponent;
  return {
    getFormRecords: (formName, p) => api.get(`/forms/json/${enc(formName)}/records`, { query: { sIndex: p?.sIndex, limit: p?.limit, searchColumn: p?.searchColumn, searchValue: p?.searchValue } }),
    addFormRecord: (formName, inputData) => api.post(`/forms/json/${enc(formName)}/insertRecord`, { query: { inputData: JSON.stringify(inputData) } }),
    updateFormRecord: (formName, recordId, inputData) => api.post(`/forms/json/${enc(formName)}/updateRecord`, { query: { recordId, inputData: JSON.stringify(inputData) } }),
    getEmployees: (p) => api.get(`/forms/json/employee/records`, { query: { sIndex: p?.sIndex, limit: p?.limit } }),
    addLeave: (inputData) => api.post(`/forms/json/leave/insertRecord`, { query: { inputData: JSON.stringify(inputData) } }),
    attendanceCheckIn: (params) => api.post(`/attendance`, { query: { empId: params.empId, dateTime: params.dateTime, checkIn: params.checkIn ? "true" : "false" } }),
  };
}
