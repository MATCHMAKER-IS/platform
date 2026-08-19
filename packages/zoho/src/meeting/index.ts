/**
 * `@platform/zoho/meeting` — Zoho Meeting API（v2）クライアント。
 *
 * ベースは `meeting.zoho.{dc}/api/v2`。
 *
 * 【`zsoid`（組織 ID）が要ります】
 * ほとんどの API が組織 ID を含む URL です。
 * **アクセストークンからは分かりません**——
 * Zoho Meeting の管理画面で確認して、**設定に入れておいてください**。
 *
 * 【時刻の指定に注意】
 * **開始時刻は「その組織のタイムゾーン」で解釈されます。**
 * `timeZone` を必ず渡してください（日本なら `Asia/Tokyo`）——
 * 渡さないと**組織の既定**が使われ、**9 時間ずれた会議**ができます。
 *
 * @packageDocumentation
 */
import type { Result } from "@platform/core";

import { createZohoApiClient } from "../core/client";
import { serviceClientParts, type ZohoDataCenter } from "../core/datacenter";

/** 会議。 */
export interface ZohoMeeting {
  meetingKey?: string;
  topic?: string;
  /** 開始時刻（`MM/dd/yyyy HH:mm:ss` 形式）。 */
  startTime?: string;
  duration?: string;
  /** 主催者が入る URL。 */
  startUrl?: string;
  /** 参加者に配る URL。 */
  joinLink?: string;
  presenter?: string;
}

/** 会議を作るときの入力。 */
export interface ZohoMeetingCreateInput {
  /** 会議名。**参加者の招待メールに出ます**。 */
  topic: string;
  /** 開始時刻（`MM/dd/yyyy HH:mm:ss`）。**`timeZone` と必ず組で**。 */
  startTime: string;
  /** タイムゾーン（日本なら `Asia/Tokyo`）。**省略すると 9 時間ずれます**。 */
  timeZone: string;
  /** 長さ（分）。 */
  duration: number;
  /** 主催者の Zoho ID（省略時は呼び出した人）。 */
  presenter?: string;
  /** 参加者のメール（カンマ区切り）。**招待メールが飛びます**。 */
  participants?: string;
  /** 参加時に音声を切っておくか（既定 true。**大人数では必須**）。 */
  muteOnEntry?: boolean;
  /** 録画するか。**録画は容量を使うので、必要なときだけ**。 */
  recordEnabled?: boolean;
}

/** Zoho Meeting のクライアント。 */
export interface ZohoMeetingClient {
  /**
   * 会議を作る。
   *
   * **`timeZone` を必ず渡してください。** 渡さないと組織の既定が使われ、
   * **9 時間ずれた会議**ができます——参加者は誰も来ません。
   *
   * **`participants` を渡すと招待メールが飛びます。**
   * 試しに作るときは**空にしてください**——
   * テストの会議に全員が招待されると混乱します。
   */
  create(zsoid: string, input: ZohoMeetingCreateInput): Promise<Result<unknown>>;

  /**
   * 会議の一覧。
   *
   * **既定は「これから」の会議だけ**です。過去のものは
   * `listType: "past"` を渡してください。
   */
  list(
    zsoid: string,
    options?: { listType?: "upcoming" | "past" | "all"; index?: number; count?: number },
  ): Promise<Result<{ session?: ZohoMeeting[] }>>;

  /** 会議の詳細（参加 URL を得るのに使います）。 */
  get(zsoid: string, meetingKey: string): Promise<Result<{ session?: ZohoMeeting }>>;

  /**
   * 会議を消す。
   *
   * **参加者に取り消しの連絡は行きません。**
   * **消す前に自分で知らせてください**——
   * 当日に「部屋が無い」となるのが一番困ります。
   */
  delete(zsoid: string, meetingKey: string): Promise<Result<unknown>>;
}

/**
 * Zoho Meeting のクライアントを作る。
 *
 * @param config `accessToken` と `dataCenter`（日本なら `jp`）
 * @returns Zoho Meeting のクライアント
 */
export function createZohoMeetingClient(config: {
  accessToken: string;
  dataCenter: ZohoDataCenter;
  fetchImpl?: typeof fetch;
}): ZohoMeetingClient {
  const api = createZohoApiClient({
    ...serviceClientParts("meeting", config.dataCenter),
    accessToken: config.accessToken,
    fetchImpl: config.fetchImpl,
  });
  const enc = (v: string) => encodeURIComponent(v);

  return {
    create: (zsoid, input) =>
      api.post(`/${enc(zsoid)}/sessions.json`, {
        body: {
          session: {
            topic: input.topic,
            startTime: input.startTime,
            timezone: input.timeZone,
            duration: String(input.duration),
            ...(input.presenter === undefined ? {} : { presenter: input.presenter }),
            ...(input.participants === undefined ? {} : { participants: input.participants }),
            // **既定で音声を切る。** 大人数の会議で全員の音声が入ると、
            // **最初の数分が雑音で潰れます**。
            muteOnEntry: input.muteOnEntry ?? true,
            recordEnabled: input.recordEnabled ?? false,
          },
        },
      }),

    list: (zsoid, options = {}) =>
      api.get(`/${enc(zsoid)}/sessions.json`, {
        query: {
          listType: options.listType ?? "upcoming",
          index: String(options.index ?? 1),
          count: String(Math.min(options.count ?? 50, 100)),
        },
      }),

    get: (zsoid, meetingKey) =>
      api.get(`/${enc(zsoid)}/sessions/${enc(meetingKey)}.json`),

    delete: (zsoid, meetingKey) =>
      api.delete(`/${enc(zsoid)}/sessions/${enc(meetingKey)}.json`),
  };
}
