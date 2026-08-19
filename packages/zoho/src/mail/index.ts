/**
 * `@platform/zoho/mail` — Zoho Mail API（v1）クライアント。
 *
 * ベースは `mail.zoho.{dc}/api`。
 *
 * 【まず知っておくこと】
 * **`accountId` が要ります。** Zoho Mail のほとんどの API は
 * メールアドレスではなく**アカウント ID**で指定します。
 * 起動時に {@link ZohoMailClient.listAccounts} で引いて**控えておいてください**
 * ——毎回引くと、**呼び出しが 2 倍**になります。
 *
 * 【送信の注意】
 * **1 日の送信数に上限があります**（契約により 200〜1,000 通/日）。
 * 超えると**その日は送れません**——大量配信には
 * **Zoho Campaigns**（`@platform/zoho/campaigns`）を使ってください。
 *
 * **「送れなかった」に気づける形にしてください。** 上限に当たると
 * エラーで返りますが、**握りつぶすと「送ったつもり」**になります。
 *
 * @packageDocumentation
 */
import type { Result } from "@platform/core";

import { createZohoApiClient } from "../core/client";
import { serviceClientParts, type ZohoDataCenter } from "../core/datacenter";

/** メールのアカウント。 */
export interface ZohoMailAccount {
  accountId?: string;
  /** 送信元として使えるアドレス。 */
  primaryEmailAddress?: string;
  displayName?: string;
}

/** 受信箱の 1 通（一覧に出る分だけ）。 */
export interface ZohoMailMessage {
  messageId?: string;
  subject?: string;
  fromAddress?: string;
  toAddress?: string;
  /** 受信時刻（**ミリ秒の文字列**で返ります）。 */
  receivedTime?: string;
  /** 未読なら `"false"`（**文字列**です。真偽値ではありません）。 */
  status2?: string;
  /** 添付があるか。 */
  hasAttachment?: string;
}

/** 送るメール。 */
export interface ZohoMailSendInput {
  /** 送信元（**アカウントに紐づくアドレスのみ**）。 */
  fromAddress: string;
  /** 宛先（**カンマ区切りで複数**）。 */
  toAddress: string;
  subject: string;
  content: string;
  /** `html` か `plaintext`（既定 `html`）。 */
  mailFormat?: "html" | "plaintext";
  ccAddress?: string;
  bccAddress?: string;
}

/** Zoho Mail のクライアント。 */
export interface ZohoMailClient {
  /**
   * アカウントの一覧。
   *
   * **`accountId` を得るために最初に呼びます。**
   * 結果は**変わらないので控えておいてください**——
   * 毎回呼ぶと呼び出しが 2 倍になります。
   */
  listAccounts(): Promise<Result<{ data?: ZohoMailAccount[] }>>;

  /**
   * メールを送る。
   *
   * **1 日の上限があります**（契約により 200〜1,000 通/日）。
   * 超えるとエラーで返るので、**握りつぶさないでください**
   * ——**「送ったつもり」が一番困ります**。
   *
   * **大量配信には使わないでください**（Campaigns を使ってください）。
   */
  send(accountId: string, input: ZohoMailSendInput): Promise<Result<unknown>>;

  /**
   * 受信箱を見る。
   *
   * **既定は 10 件**です。`limit` は**最大 200**——
   * それ以上は `start` をずらして繰り返してください。
   *
   * **オフセット方式なので、取得中にメールが届くとずれます**——
   * 一覧の途中で新着があると、**同じメールを 2 回取る**ことがあります。
   * **`messageId` で重複を除いて**ください。
   */
  listMessages(
    accountId: string,
    options?: { folderId?: string; start?: number; limit?: number },
  ): Promise<Result<{ data?: ZohoMailMessage[] }>>;

  /**
   * 本文を読む。
   *
   * **一覧には本文が入っていません**——必要な分だけ引いてください。
   * 全件の本文を引くと、**件数分の呼び出し**になります。
   */
  getMessageContent(
    accountId: string,
    messageId: string,
  ): Promise<Result<{ data?: { content?: string } }>>;
}

/**
 * Zoho Mail のクライアントを作る。
 *
 * @param config `accessToken` と `dataCenter`（日本なら `jp`）
 * @returns Zoho Mail のクライアント
 */
export function createZohoMailClient(config: {
  accessToken: string;
  dataCenter: ZohoDataCenter;
  fetchImpl?: typeof fetch;
}): ZohoMailClient {
  const api = createZohoApiClient({
    ...serviceClientParts("mail", config.dataCenter),
    accessToken: config.accessToken,
    fetchImpl: config.fetchImpl,
  });
  const enc = (v: string) => encodeURIComponent(v);

  return {
    listAccounts: () => api.get("/accounts"),

    send: (accountId, input) =>
      api.post(`/accounts/${enc(accountId)}/messages`, {
        body: {
          fromAddress: input.fromAddress,
          toAddress: input.toAddress,
          subject: input.subject,
          content: input.content,
          // **既定は HTML。** `plaintext` で送ると、
          // **改行がそのまま**になり読みにくくなります。
          mailFormat: input.mailFormat ?? "html",
          ...(input.ccAddress === undefined ? {} : { ccAddress: input.ccAddress }),
          ...(input.bccAddress === undefined ? {} : { bccAddress: input.bccAddress }),
        },
      }),

    listMessages: (accountId, options = {}) =>
      api.get(`/accounts/${enc(accountId)}/messages/view`, {
        query: {
          // **既定を明示する。** 指定しないと 10 件しか返らず、
          // **「メールが少ない」と誤解します**。
          start: String(options.start ?? 1),
          limit: String(Math.min(options.limit ?? 50, 200)),
          ...(options.folderId === undefined ? {} : { folderId: options.folderId }),
        },
      }),

    getMessageContent: (accountId, messageId) =>
      api.get(`/accounts/${enc(accountId)}/folders/messages/${enc(messageId)}/content`),
  };
}
