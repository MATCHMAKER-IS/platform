/**
 * `@platform/line` — LINE Messaging API クライアント。
 *
 * push / multicast / broadcast / reply / プロフィール取得を型付きで扱う。
 * 単純な通知だけなら `@platform/notify` の LINE チャネルで十分。こちらは
 * 個別ユーザーへの push や応答など、より踏み込んだ操作向け。
 * チャネルアクセストークンの取得・更新はアプリ側の責務。
 *
 * @packageDocumentation
 */

import { createApiClient } from "@platform/integrations";
// **`ok` / `err` / `AppError` は値として使う。** `import type` だけだと
// 実行時に存在せず、**リッチメニューの画像送信で `ReferenceError`** になる
// (2026-08、型検査が回っていなかったため気づけなかった)。
import { ok, err, AppError, ErrorCode, type Result } from "@platform/core";

/** LINE のメッセージオブジェクト(text 以外も渡せるよう緩めに型付け)。 */
import type { LineMessage } from "./types";
export type { LineMessage };

/** LINE プロフィール。 */
export interface LineProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
}

/** LINE クライアント。 */
/**
 * multicast の 1 回あたりの上限(LINE の仕様)。
 *
 * **超えると 400 が返り、部分的にも送られない。** 501 人へ送ろうとすると
 * 誰にも届かないまま終わるので、呼び出し側が意識しなくてよいように分割する。
 */
export const LINE_MULTICAST_LIMIT = 500;

export interface LineClient {
  /** 単一ユーザー/グループへ push する。 */
  push(to: string, messages: LineMessage[]): Promise<Result<unknown>>;
  /** テキストを push する簡易版。 */
  pushText(to: string, text: string): Promise<Result<unknown>>;
  /** 複数ユーザーへ multicast する。 */
  multicast(to: string[], messages: LineMessage[]): Promise<Result<unknown>>;
  /** 全友だちへ broadcast する。 */
  broadcast(messages: LineMessage[]): Promise<Result<unknown>>;
  /** 応答トークンで返信する。 */
  reply(replyToken: string, messages: LineMessage[]): Promise<Result<unknown>>;
  /** ユーザープロフィールを取得する。 */
  getProfile(userId: string): Promise<Result<LineProfile>>;
  /** グループ内メンバーのプロフィールを取得する。 */
  getGroupMemberProfile(groupId: string, userId: string): Promise<Result<LineProfile>>;
  /** リッチメニューを作成し、リッチメニュー ID を返す。 */
  createRichMenu(richMenu: Record<string, unknown>): Promise<Result<{ richMenuId: string }>>;
  /** ユーザーにリッチメニューをリンクする。 */
  linkRichMenu(userId: string, richMenuId: string): Promise<Result<unknown>>;
  /** デフォルトのリッチメニューを設定する(全ユーザー)。 */
  setDefaultRichMenu(richMenuId: string): Promise<Result<unknown>>;
  /** リッチメニューを削除する。 */
  deleteRichMenu(richMenuId: string): Promise<Result<unknown>>;

  /**
   * リッチメニューの**画像を送る**。
   *
   * **画像が無いとリッチメニューは表示されません。**
   * 作成しただけでは何も起きず、**「設定したのに出ない」**という状態になります。
   *
   * **決まりが厳しい**です（守らないと弾かれます）:
   *
   * | | |
   * |---|---|
   * | 大きさ | **2500×1686** / **2500×843**（小さい方は 1200×810 / 1200×405 も可） |
   * | 形式 | **JPEG か PNG** |
   * | 容量 | **1MB 以下** |
   *
   * **送り先は `api-data.line.me`**（他の API とは別のドメイン）です——
   * 間違えると **404 になり、原因が分かりにくい**ので気をつけてください。
   *
   * @param richMenuId `createRichMenu` が返した ID
   * @param image 画像の中身
   * @param contentType `image/jpeg` か `image/png`
   */
  uploadRichMenuImage(
    richMenuId: string,
    image: Uint8Array,
    contentType: "image/jpeg" | "image/png",
  ): Promise<Result<undefined>>;
  /** チャットにローディングアニメーションを表示する(応答準備中の演出)。 */
  showLoadingAnimation(chatId: string, seconds?: number): Promise<Result<unknown>>;
  /**
   * **利用者が送ってきた画像・動画・音声を取り出す。**
   *
   * 【使いどころ】
   * 「領収書を撮って送ってください」の**受け取り側**です。
   * 撮った写真をそのまま経費申請に添付できます。
   *
   * 【必ず知っておくこと】
   * **① 保存できる期間は限られます。** LINE 側は一定期間で消すので、
   * **受け取ったらすぐ自分の保管先に写して**ください——
   * 「あとで取りに行く」は失敗します。
   *
   * **② 中身は画像とは限りません。** 利用者は何でも送れるので、
   * **種別を確かめてから扱って**ください（`@platform/bytes` の `sniffMimeType`）。
   *
   * **③ 送り先は `api-data.line.me`**（他の API とは別のドメイン）です。
   *
   * @param messageId Webhook で受け取ったメッセージの ID
   * @returns 中身と種別
   */
  getContent(
    messageId: string,
  ): Promise<Result<{ content: Uint8Array; contentType: string }>>;

  /**
   * **友だちの一覧**（利用者 ID）。
   *
   * **1 回に 1,000 件まで**で、続きは `start` に前回の `next` を渡します。
   *
   * **全件を毎回引かないでください**——友だちが 1 万人なら 10 回の呼び出しで、
   * **送信数の上限とは別に、呼び出し回数の上限**にも当たります。
   * **控えておいて、差分だけ**見る方が確かです。
   *
   * **退会・ブロックした人は返りません。**
   * 「前に居たのに居ない」はエラーではありません。
   *
   * @param options `limit`（最大 1,000）と `start`（続きの位置）
   * @returns 利用者 ID の一覧と、続きがあれば `next`
   */
  getFollowerIds(options?: {
    limit?: number;
    start?: string;
  }): Promise<Result<{ userIds?: string[]; next?: string }>>;

  /**
   * **アカウント連携用の一時トークン**を発行する。
   *
   * 【何に使うか】
   * **LINE の利用者と、社内システムの利用者を結び付ける**ためのものです。
   * 「LINE で承認したい」なら、**どの社員かが分からないと始まりません**。
   *
   * 【必ず知っておくこと】
   * **有効期間は 10 分**です。発行したらすぐ使わせてください——
   * 画面に出したまま放置されると切れます。
   *
   * **1 回しか使えません。** 使い回そうとすると失敗します。
   *
   * @param userId 結び付ける LINE の利用者 ID
   * @returns 連携用のトークン
   */
  issueLinkToken(userId: string): Promise<Result<{ linkToken?: string }>>;

  /**
   * **今月すでに何通送ったか。**
   *
   * LINE は**従量課金**で、無料枠を超えると**1 通ずつ課金**されます。
   * {@link getMessageQuota} は**上限**を返しますが、**今いくつ使ったかは別**
   * ——**両方を見ないと「あと何通送れるか」が分かりません**。
   *
   * **月末に足りなくなるのが一番困ります**——
   * 「請求の案内が送れない」は業務が止まります。
   * **8 割を超えたら知らせる**などの仕組みにしてください。
   *
   * **数は月単位**です（毎日リセットされません）。
   *
   * @returns `totalUsage`（**文字列で返ります**——数として扱うなら変換してください）
   */
  getQuotaConsumption(): Promise<Result<{ totalUsage?: string }>>;

  /** 当月の push メッセージ利用状況(上限・消費数)を取得する。 */
  getMessageQuota(): Promise<Result<{ type: string; value?: number }>>;
}

/**
 * LINE クライアントを作る。
 * @param config `channelAccessToken` … LINE Messaging API のチャネルアクセストークン
 * @returns {@link LineClient}
 *
 * @example
 * ```ts
 * const line = createLineClient({ channelAccessToken: env.LINE_CHANNEL_ACCESS_TOKEN });
 * await line.pushText("U1234...", "承認されました");
 * ```
 */
export function createLineClient(config: { channelAccessToken: string; fetchImpl?: typeof fetch }): LineClient {
  const api = createApiClient({
    baseUrl: "https://api.line.me/v2/bot",
    headers: { Authorization: `Bearer ${config.channelAccessToken}` },
    fetchImpl: config.fetchImpl,
  });
  return {
    push: (to, messages) => api.post("/message/push", { body: { to, messages } }),
    pushText: (to, text) => api.post("/message/push", { body: { to, messages: [{ type: "text", text }] } }),
    // **500 人ずつに分ける。** LINE の multicast は 1 回 500 人までで、
    // 超えると 400 が返り**部分的にも送られない**(全部失敗)。
    // 501 人へ送ろうとすると**誰にも届かない**まま終わる(2026-08 に対処)。
    multicast: async (to, messages) => {
      // **依存を増やさない。** `ok()` を import すると smoke の差し替えで壊れる
      if (to.length === 0) return { ok: true, value: undefined };
      const chunks: string[][] = [];
      for (let i = 0; i < to.length; i += LINE_MULTICAST_LIMIT) {
        chunks.push(to.slice(i, i + LINE_MULTICAST_LIMIT));
      }
      // **1 つでも失敗したらそこで止める。** 続けると「どこまで送ったか」が
      // 分からなくなり、再送で二重に届く
      for (const chunk of chunks) {
        const res = await api.post("/message/multicast", { body: { to: chunk, messages } });
        if (!res.ok) return res;
      }
      return { ok: true, value: undefined };
    },
    broadcast: (messages) => api.post("/message/broadcast", { body: { messages } }),
    reply: (replyToken, messages) => api.post("/message/reply", { body: { replyToken, messages } }),
    getProfile: (userId) => api.get<LineProfile>(`/profile/${encodeURIComponent(userId)}`),
    getGroupMemberProfile: (groupId, userId) =>
      api.get<LineProfile>(`/group/${encodeURIComponent(groupId)}/member/${encodeURIComponent(userId)}`),
    createRichMenu: (richMenu) => api.post<{ richMenuId: string }>("/richmenu", { body: richMenu }),
    linkRichMenu: (userId, richMenuId) =>
      api.post(`/user/${encodeURIComponent(userId)}/richmenu/${encodeURIComponent(richMenuId)}`, { body: {} }),
    setDefaultRichMenu: (richMenuId) =>
      api.post(`/user/all/richmenu/${encodeURIComponent(richMenuId)}`, { body: {} }),
    deleteRichMenu: (richMenuId) => api.delete(`/richmenu/${encodeURIComponent(richMenuId)}`),

    async uploadRichMenuImage(richMenuId, image, contentType) {
      // **画像は別のドメイン（`api-data.line.me`）へ送ります。**
      // `api.line.me` に送っても**404 になり、原因が分かりにくい**ので注意してください。
      //
      // **画像が無いとリッチメニューは表示されません。**
      // 作成しただけでは何も起きず、**「設定したのに出ない」**という状態になります。
      //
      // **決まりが厳しい**です（守らないと弾かれます）:
      // - 大きさ: **2500×1686** か **2500×843**（小さい方は 1200×810 / 1200×405 も可）
      // - 形式: **JPEG か PNG**
      // - 容量: **1MB 以下**
      const res = await (config.fetchImpl ?? fetch)(
        `https://api-data.line.me/v2/bot/richmenu/${encodeURIComponent(richMenuId)}/content`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${config.channelAccessToken}`,
            "content-type": contentType,
          },
          // **`as BodyInit`。** TypeScript が `Uint8Array` を
          // ジェネリック化して以降(`Uint8Array<ArrayBufferLike>`)、
          // `BodyInit` との構造的な適合が崩れることがある——
          // `packages/microsoft/src/graph.ts` と同じ対処
          // (2026-08、ユーザー環境での `pnpm -r typecheck` で発見)。
          body: image as BodyInit,
        },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return err(new AppError(
          ErrorCode.EXTERNAL,
          `LINE: リッチメニューの画像を送れませんでした（${res.status}）${text.slice(0, 200)}`,
        ));
      }
      return ok(undefined);
    },
    showLoadingAnimation: (chatId, seconds = 20) =>
      api.post("/chat/loading/start", { body: { chatId, loadingSeconds: seconds } }),
    getMessageQuota: () => api.get<{ type: string; value?: number }>("/message/quota"),

    getQuotaConsumption: () =>
      // **今月すでに何通送ったか。**
      //
      // 【なぜ要るか】
      // LINE は**従量課金**で、無料枠を超えると**1 通ずつ課金**されます。
      // `getMessageQuota` は**上限**を返しますが、**今いくつ使ったかは別**——
      // **両方を見ないと「あと何通送れるか」が分かりません**。
      //
      // **月末に足りなくなるのが一番困ります**——
      // 「請求の案内が送れない」は業務が止まります。
      // **8 割を超えたら知らせる**などの仕組みにしてください。
      //
      // **数は毎日リセットされません**（月単位です）。
      api.get<{ totalUsage?: string }>("/message/quota/consumption"),

    async getContent(messageId) {
      // **利用者が送ってきた画像・動画・音声を取り出す。**
      //
      // **送り先は `api-data.line.me`**（他の API とは別のドメイン）です
      // ——間違えると **404 になり、原因が分かりにくい**。
      //
      // **保存できる期間は限られます。** LINE 側は一定期間で消すので、
      // **受け取ったらすぐ自分の保管先に写して**ください
      // ——「あとで取りに行く」は失敗します。
      //
      // **中身は画像とは限りません。** 利用者は何でも送れるので、
      // **種別を確かめてから扱って**ください（`@platform/bytes` の `sniffMimeType`）。
      const res = await (config.fetchImpl ?? fetch)(
        `https://api-data.line.me/v2/bot/message/${encodeURIComponent(messageId)}/content`,
        { headers: { authorization: `Bearer ${config.channelAccessToken}` } },
      );
      if (!res.ok) {
        return err(new AppError(
          ErrorCode.EXTERNAL,
          `LINE: 受信した中身を取得できませんでした（${res.status}）`,
        ));
      }
      const buf = new Uint8Array(await res.arrayBuffer());
      return ok({
        content: buf,
        contentType: res.headers.get("content-type") ?? "application/octet-stream",
      });
    },

    getFollowerIds: (options = {}) =>
      // **友だちの一覧。**
      //
      // **1 回に 1,000 件まで**で、続きは `next` を渡します。
      // **全件を毎回引かないでください**——友だちが 1 万人なら 10 回の呼び出しで、
      // **送信数の上限とは別に、呼び出し回数の上限**にも当たります。
      //
      // **退会した人は返りません。** 「前に居たのに居ない」は
      // **ブロックか退会**——エラーではありません。
      api.get<{ userIds?: string[]; next?: string }>("/followers/ids", {
        query: {
          limit: String(Math.min(options.limit ?? 300, 1000)),
          ...(options.start === undefined ? {} : { start: options.start }),
        },
      }),

    issueLinkToken: (userId) =>
      // **アカウント連携用の一時トークン。**
      //
      // 【何に使うか】
      // **LINE の利用者と、社内システムの利用者を結び付ける**ためのものです。
      // 「LINE で承認したい」なら、**どの社員かが分からないと始まりません**。
      //
      // **有効期間は 10 分**です。発行したらすぐ使わせてください
      // ——画面に出したまま放置されると切れます。
      //
      // **1 回しか使えません。** 使い回そうとすると失敗します。
      api.post<{ linkToken?: string }>(
        `/user/${encodeURIComponent(userId)}/linkToken`,
        { body: {} },
      ),
  };
}

// **宛先の判定は `./recipient` に分けてある。** 画面から使うときは
// `@platform/line/recipient` を直接取ること（ここは node:crypto を巻き込む）
export { lineRecipientType, isValidLineRecipient, type LineRecipientType } from "./recipient";

export * from "./messages";
export * from "./webhook";
export * from "./rich-menu";
