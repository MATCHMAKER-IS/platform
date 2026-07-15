/**
 * `@platform/zoho/bookings` — Zoho Bookings API(v1)クライアント。
 * ベースは `zohoapis.{dc}/bookings/v1/json`。サービス/スタッフ/空き枠/予約。
 * レスポンスは `{ response: { returnvalue, status } }` 形式。
 * @packageDocumentation
 */
import type { Result } from "@platform/core";
import { createZohoApiClient } from "../core/client.js";
import { serviceBaseUrl, type ZohoDataCenter } from "../core/datacenter.js";

/** Bookings レスポンス(緩め)。 */
export type BookingsRecord = Record<string, unknown>;

/** Bookings クライアント設定。 */
export interface ZohoBookingsConfig { dataCenter: ZohoDataCenter; accessToken: string; fetchImpl?: typeof fetch }

/** 予約作成の入力。 */
export interface AppointmentInput {
  service_id: string;
  staff_id?: string;
  resource_id?: string;
  from_time: string;
  timezone?: string;
  customer_details: { name: string; email: string; phone_number?: string };
  notes?: string;
  additional_fields?: Record<string, unknown>;
}

/** Bookings クライアント。 */
export interface ZohoBookingsClient {
  /** ワークスペース一覧。 */
  fetchWorkspaces(): Promise<Result<BookingsRecord>>;
  /** サービス一覧(workspace 単位)。 */
  fetchServices(params?: { workspaceId?: string }): Promise<Result<BookingsRecord>>;
  /** スタッフ一覧。 */
  fetchStaff(params?: { serviceId?: string }): Promise<Result<BookingsRecord>>;
  /** 空き枠取得(selected_date は "30-Apr-2020:00:00" 形式)。 */
  fetchAvailability(params: { serviceId: string; staffId?: string; selectedDate: string }): Promise<Result<BookingsRecord>>;
  /** 予約作成。 */
  bookAppointment(input: AppointmentInput): Promise<Result<BookingsRecord>>;
  /** 予約詳細(booking_id 指定)。 */
  getAppointment(bookingId: string): Promise<Result<BookingsRecord>>;
  /** 予約一覧(時間範囲・ページング)。 */
  fetchAppointments(params?: { fromTime?: string; toTime?: string; page?: number; status?: string }): Promise<Result<BookingsRecord>>;
  /** 予約更新(ステータス変更等)。 */
  updateAppointment(params: { bookingId: string; action: string; [key: string]: unknown }): Promise<Result<BookingsRecord>>;
}

/** Zoho Bookings クライアントを作る。 */
export function createZohoBookingsClient(config: ZohoBookingsConfig): ZohoBookingsClient {
  const api = createZohoApiClient({ apiDomain: serviceBaseUrl("bookings", config.dataCenter), basePath: "", accessToken: config.accessToken, fetchImpl: config.fetchImpl });
  return {
    fetchWorkspaces: () => api.get(`/workspaces`),
    fetchServices: (p) => api.get(`/services`, { query: { workspace_id: p?.workspaceId } }),
    fetchStaff: (p) => api.get(`/staffs`, { query: { service_id: p?.serviceId } }),
    fetchAvailability: (p) => api.get(`/availableslots`, { query: { service_id: p.serviceId, staff_id: p.staffId, selected_date: p.selectedDate } }),
    bookAppointment: (input) => api.post(`/appointment`, {
      body: {
        service_id: input.service_id, staff_id: input.staff_id, resource_id: input.resource_id,
        from_time: input.from_time, timezone: input.timezone,
        customer_details: JSON.stringify(input.customer_details),
        notes: input.notes,
        additional_fields: input.additional_fields ? JSON.stringify(input.additional_fields) : undefined,
      },
    }),
    getAppointment: (bookingId) => api.get(`/getappointment`, { query: { booking_id: bookingId } }),
    fetchAppointments: (p) => api.get(`/fetchappointment`, { query: { from_time: p?.fromTime, to_time: p?.toTime, page: p?.page, status: p?.status } }),
    updateAppointment: (params) => api.post(`/updateappointment`, { body: params }),
  };
}
