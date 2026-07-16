/**
 * freee 人事労務 API クライアント。会計 API とは別サービス(base URL が異なる)。
 * 従業員・勤怠(打刻/勤怠記録)・勤怠集計・給与明細を扱う。company_id と従業員 ID が軸。
 * トークンは会計 API と同じ OAuth(createFreeeAuthedFetch を注入可能)。
 * @packageDocumentation
 */
import { createApiClient } from "@platform/integrations";
import type { Result } from "@platform/core";

/** 勤怠記録の入力(打刻・修正)。 */
export interface WorkRecordInput {
  /** 勤務日 "YYYY-MM-DD"。 */
  date: string;
  /** 出勤時刻 "YYYY-MM-DDTHH:MM:SS"(任意)。 */
  clockInAt?: string;
  /** 退勤時刻。 */
  clockOutAt?: string;
  /** 休憩(開始・終了の配列)。 */
  breakRecords?: { clockInAt: string; clockOutAt: string }[];
  /** 遅刻・早退・全休などの区分(freee の勤怠区分)。 */
  dayPattern?: string;
  note?: string;
}

/** freee 人事労務クライアント。 */
export interface FreeeHrClient {
  /** 認証中ユーザー。 */
  getMe(): Promise<Result<unknown>>;
  /** 事業所一覧(人事労務)。 */
  getCompanies(): Promise<Result<unknown>>;
  /** 従業員一覧。 */
  getEmployees(companyId: number, params?: { limit?: number; offset?: number }): Promise<Result<unknown>>;
  /** 従業員詳細。 */
  getEmployee(companyId: number, employeeId: number): Promise<Result<unknown>>;
  /** 指定日の勤怠記録を取得する。 */
  getWorkRecord(employeeId: number, date: string, companyId: number): Promise<Result<unknown>>;
  /** 指定日の勤怠記録を登録・更新する(打刻の登録/修正)。 */
  putWorkRecord(employeeId: number, record: WorkRecordInput, companyId: number): Promise<Result<unknown>>;
  /** 指定日の勤怠記録を削除する。 */
  deleteWorkRecord(employeeId: number, date: string, companyId: number): Promise<Result<unknown>>;
  /** 月次の勤怠集計(勤務時間・残業・休暇等)。 */
  getWorkRecordSummary(employeeId: number, year: number, month: number, companyId: number): Promise<Result<unknown>>;
  /** 従業員の給与明細一覧。 */
  getEmployeePaySlips(companyId: number, employeeId: number, params?: { limit?: number; offset?: number }): Promise<Result<unknown>>;
}

/**
 * freee 人事労務クライアントを作る。
 * @param config `accessToken`(会計と同じ OAuth)/ `fetchImpl`(認証付き fetch を注入可能)
 * @returns 人事労務のクライアント。**会計とは別の API**(ドメインもトークンのスコープも違う)
 */
export function createFreeeHrClient(config: { accessToken: string; fetchImpl?: typeof fetch }): FreeeHrClient {
  const api = createApiClient({
    baseUrl: "https://api.freee.co.jp/hr/api/v1",
    headers: { Authorization: `Bearer ${config.accessToken}` },
    fetchImpl: config.fetchImpl,
  });
  return {
    getMe: () => api.get("/users/me"),
    getCompanies: () => api.get("/companies"),
    getEmployees: (companyId, p) => api.get(`/companies/${companyId}/employees`, { query: { limit: p?.limit, offset: p?.offset } }),
    getEmployee: (companyId, employeeId) => api.get(`/companies/${companyId}/employees/${employeeId}`, {}),
    getWorkRecord: (employeeId, date, companyId) =>
      api.get(`/employees/${employeeId}/work_records/${date}`, { query: { company_id: companyId } }),
    putWorkRecord: (employeeId, record, companyId) =>
      api.put(`/employees/${employeeId}/work_records/${record.date}`, {
        body: {
          company_id: companyId,
          ...(record.clockInAt ? { clock_in_at: record.clockInAt } : {}),
          ...(record.clockOutAt ? { clock_out_at: record.clockOutAt } : {}),
          ...(record.breakRecords ? { break_records: record.breakRecords.map((b) => ({ clock_in_at: b.clockInAt, clock_out_at: b.clockOutAt })) } : {}),
          ...(record.dayPattern ? { day_pattern: record.dayPattern } : {}),
          ...(record.note ? { note: record.note } : {}),
        },
      }),
    deleteWorkRecord: (employeeId, date, companyId) =>
      api.delete(`/employees/${employeeId}/work_records/${date}`, { query: { company_id: companyId } }),
    getWorkRecordSummary: (employeeId, year, month, companyId) =>
      api.get(`/employees/${employeeId}/work_record_summaries/${year}/${month}`, { query: { company_id: companyId } }),
    getEmployeePaySlips: (companyId, employeeId, p) =>
      api.get(`/companies/${companyId}/employees/${employeeId}/pay_slips`, { query: { limit: p?.limit, offset: p?.offset } }),
  };
}
