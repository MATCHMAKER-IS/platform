/**
 * `@platform/google` — Google Workspace API クライアント(Sheets / Calendar)。
 *
 * 社内アプリで需要が高い Google スプレッドシートの読み書きと、
 * カレンダー予定の取得を型付きで扱う。OAuth によるアクセストークンの取得は
 * アプリ側の責務(SSO と同様)。ここはトークンを受け取って API を叩くだけ。
 *
 * @packageDocumentation
 */

import { createApiClient } from "@platform/integrations";
import type { Result } from "@platform/core";

/** Google Sheets クライアント。 */
export interface GoogleSheetsClient {
  /** 範囲の値を取得する(例: range = "Sheet1!A1:C10")。 */
  getValues(spreadsheetId: string, range: string): Promise<Result<{ values?: string[][] }>>;
  /** 範囲の末尾に行を追記する。 */
  appendRows(spreadsheetId: string, range: string, values: unknown[][]): Promise<Result<unknown>>;
  /** 範囲の値を更新する。 */
  updateRows(spreadsheetId: string, range: string, values: unknown[][]): Promise<Result<unknown>>;
}

/**
 * Google Sheets クライアントを作る。
 * @param config `accessToken` … OAuth アクセストークン(scope: spreadsheets)
 * @returns {@link GoogleSheetsClient}
 *
 * @example
 * ```ts
 * const sheets = createGoogleSheetsClient({ accessToken });
 * await sheets.appendRows(sheetId, "Sheet1!A1", [["山田", 1000]]);
 * const res = await sheets.getValues(sheetId, "Sheet1!A1:B10");
 * ```
 */
export function createGoogleSheetsClient(config: { accessToken: string; fetchImpl?: typeof fetch }): GoogleSheetsClient {
  const api = createApiClient({
    baseUrl: "https://sheets.googleapis.com/v4/spreadsheets",
    headers: { Authorization: `Bearer ${config.accessToken}` },
    fetchImpl: config.fetchImpl,
  });
  const enc = (r: string) => encodeURIComponent(r);
  return {
    getValues: (id, range) =>
      api.get<{ values?: string[][] }>(`/${id}/values/${enc(range)}`),
    appendRows: (id, range, values) =>
      api.post(`/${id}/values/${enc(range)}:append`, {
        query: { valueInputOption: "USER_ENTERED" },
        body: { values },
      }),
    updateRows: (id, range, values) =>
      api.put(`/${id}/values/${enc(range)}`, {
        query: { valueInputOption: "USER_ENTERED" },
        body: { values },
      }),
  };
}

/** Google Calendar クライアント。 */
export interface GoogleCalendarClient {
  /** 予定一覧を取得する(既定カレンダーは "primary")。 */
  listEvents(calendarId: string, params?: { timeMin?: string; timeMax?: string; maxResults?: number }): Promise<Result<{ items?: unknown[] }>>;
  /** 予定を作成する。 */
  createEvent(calendarId: string, event: Record<string, unknown>, params?: { sendUpdates?: "all" | "externalOnly" | "none" }): Promise<Result<unknown>>;
  /** 予定を更新する。 */
  updateEvent(calendarId: string, eventId: string, event: Record<string, unknown>): Promise<Result<unknown>>;
  /** 予定を削除する。 */
  deleteEvent(calendarId: string, eventId: string): Promise<Result<unknown>>;
  /** 空き時間を照会する(freeBusy)。 */
  freeBusy(params: { timeMin: string; timeMax: string; calendarIds: string[] }): Promise<Result<unknown>>;
}

/**
 * Google Calendar クライアントを作る。
 * @param config `accessToken` … OAuth アクセストークン(scope: calendar.readonly 等)
 * @returns {@link GoogleCalendarClient}
 */
export function createGoogleCalendarClient(config: { accessToken: string; fetchImpl?: typeof fetch }): GoogleCalendarClient {
  const api = createApiClient({
    baseUrl: "https://www.googleapis.com/calendar/v3",
    headers: { Authorization: `Bearer ${config.accessToken}` },
    fetchImpl: config.fetchImpl,
  });
  const cal = (id: string) => encodeURIComponent(id);
  return {
    listEvents: (calendarId, params) =>
      api.get<{ items?: unknown[] }>(`/calendars/${cal(calendarId)}/events`, {
        query: {
          timeMin: params?.timeMin,
          timeMax: params?.timeMax,
          maxResults: params?.maxResults,
          singleEvents: true,
          orderBy: "startTime",
        },
      }),
    createEvent: (calendarId, event, params) =>
      api.post(`/calendars/${cal(calendarId)}/events`, { query: { sendUpdates: params?.sendUpdates }, body: event }),
    updateEvent: (calendarId, eventId, event) =>
      api.put(`/calendars/${cal(calendarId)}/events/${encodeURIComponent(eventId)}`, { body: event }),
    deleteEvent: (calendarId, eventId) =>
      api.delete(`/calendars/${cal(calendarId)}/events/${encodeURIComponent(eventId)}`),
    freeBusy: (params) =>
      api.post(`/freeBusy`, { body: { timeMin: params.timeMin, timeMax: params.timeMax, items: params.calendarIds.map((id) => ({ id })) } }),
  };
}

/** Google Maps クライアント(Geocoding / Directions / Distance Matrix)。 */
export interface GoogleMapsClient {
  /** 住所→緯度経度(ジオコーディング)。 */
  geocode(address: string): Promise<Result<unknown>>;
  /** 緯度経度→住所(逆ジオコーディング)。 */
  reverseGeocode(lat: number, lng: number): Promise<Result<unknown>>;
  /** 経路を取得する。origin/destination は住所または "lat,lng"。 */
  directions(origin: string, destination: string, mode?: "driving" | "walking" | "transit" | "bicycling"): Promise<Result<unknown>>;
  /** 複数地点間の距離・所要時間を取得する。 */
  distanceMatrix(origins: string[], destinations: string[]): Promise<Result<unknown>>;
}

/**
 * Google Maps クライアントを作る。Maps は OAuth ではなく API キーで認証する。
 * @param config `apiKey` … Google Maps Platform の API キー
 * @returns {@link GoogleMapsClient}
 *
 * @example
 * ```ts
 * const maps = createGoogleMapsClient({ apiKey: env.GOOGLE_MAPS_API_KEY });
 * const geo = await maps.geocode("東京都千代田区丸の内1-1");
 * ```
 */
export function createGoogleMapsClient(config: { apiKey: string; fetchImpl?: typeof fetch }): GoogleMapsClient {
  const api = createApiClient({ baseUrl: "https://maps.googleapis.com/maps/api", fetchImpl: config.fetchImpl });
  const key = config.apiKey;
  return {
    geocode: (address) => api.get("/geocode/json", { query: { address, key } }),
    reverseGeocode: (lat, lng) => api.get("/geocode/json", { query: { latlng: `${lat},${lng}`, key } }),
    directions: (origin, destination, mode = "driving") =>
      api.get("/directions/json", { query: { origin, destination, mode, key } }),
    distanceMatrix: (origins, destinations) =>
      api.get("/distancematrix/json", {
        query: { origins: origins.join("|"), destinations: destinations.join("|"), key },
      }),
  };
}

export * from "./oauth";
export * from "./gmail";
export * from "./drive";
