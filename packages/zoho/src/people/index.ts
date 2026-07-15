/**
 * `@platform/zoho/people` — Zoho People API クライアント。
 * ベースは `people.zoho.{dc}/people/api`。フォーム(従業員/休暇/勤怠)ベース。
 * @packageDocumentation
 */
import type { Result } from "@platform/core";
import { createZohoApiClient } from "../core/client.js";
import { serviceBaseUrl, type ZohoDataCenter } from "../core/datacenter.js";

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

/** Zoho People クライアントを作る。 */
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
