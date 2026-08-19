/**
 * `@platform/zoho/vault` — Zoho Vault API（v1）クライアント。
 *
 * ベースは `vault.zoho.{dc}/api/rest/json/v1`。
 *
 * 【このパッケージを使う前に読んでください】
 *
 * **Vault は「秘密を預ける場所」です。** 扱いを誤ると、
 * **社内の全てのパスワードが漏れます**——他の連携とは危険度が違います。
 *
 * **① 取り出した秘密をログに出さないこと。**
 * `console.log(secret)` の 1 行で、**ログを見られる全員に漏れます**。
 * 基盤のログは伏せ字を通しますが、**`console.log` は素通り**です。
 *
 * **② 取り出した秘密を保存しないこと。**
 * DB やファイルに写すと、**Vault で管理している意味が無くなります**
 * ——使うときに引いて、**使い終わったら捨ててください**。
 *
 * **③ アクセストークンの権限を最小にすること。**
 * `ZohoVault.secrets.READ` だけで足りることがほとんどです。
 * 書き込み権限を付けると、**事故で消せる**ようになります。
 *
 * 【何に使うか】
 * **外部サービスの鍵を 1 か所にまとめる**のが主な用途です。
 * `.env` に散らばった鍵を Vault に集めれば、
 * **入れ替えるときに 1 か所で済み**、**誰がいつ見たかも残ります**。
 *
 * ただし**起動のたびに引くと、Vault が落ちたらアプリも起動できません**——
 * **起動時に 1 回引いて持っておく**か、`.env` を残して**併用**してください。
 *
 * @packageDocumentation
 */
import type { Result } from "@platform/core";

import { createZohoApiClient } from "../core/client";
import { serviceClientParts, type ZohoDataCenter } from "../core/datacenter";

/** 秘密の 1 件（**中身は入っていません**）。 */
export interface ZohoVaultSecretSummary {
  secretid?: string;
  secretname?: string;
  /** どの分類か。 */
  chamberid?: string;
  /** 種類（`Web Account` / `File Store` など）。 */
  secrettypeid?: string;
  /** 最後に触った時刻。 */
  lastmodifiedtime?: string;
}

/** 秘密の中身。 */
export interface ZohoVaultSecretDetail {
  secretid?: string;
  secretname?: string;
  /**
   * 中身（**鍵と値の対応**）。
   *
   * **ここをログに出さないでください。**
   * `password` / `apikey` などがそのまま入っています。
   */
  secretData?: Record<string, string>;
  description?: string;
}

/** Zoho Vault のクライアント。 */
export interface ZohoVaultClient {
  /**
   * 秘密の一覧（**中身は返りません**）。
   *
   * 名前と ID だけなので、**画面に出しても比較的安全**です。
   * 中身が要るときだけ {@link getSecret } を呼んでください。
   */
  listSecrets(options?: {
    /** 名前で絞る。 */
    searchTerm?: string;
    /** 分類で絞る。 */
    chamberId?: string;
  }): Promise<Result<{ operation?: { Details?: { SECRETS?: ZohoVaultSecretSummary[] } } }>>;

  /**
   * 秘密の中身を取り出す。
   *
   * **取り出したら、使い終わったら捨ててください。**
   * DB やファイルに写すと、**Vault で管理している意味が無くなります**。
   *
   * **ログに出さないでください。** `console.log` は伏せ字を通りません。
   *
   * **誰がいつ見たかは Vault 側に残ります**——
   * 「勝手に見られていないか」はそちらで確認できます。
   */
  getSecret(
    secretId: string,
  ): Promise<Result<{ operation?: { Details?: ZohoVaultSecretDetail } }>>;
}

/**
 * Zoho Vault のクライアントを作る。
 *
 * **権限は最小にしてください**（読み取りだけで足りることがほとんどです）。
 * 書き込み権限を付けると、**事故で消せる**ようになります。
 *
 * @param config `accessToken` と `dataCenter`（日本なら `jp`）
 * @returns Zoho Vault のクライアント
 */
export function createZohoVaultClient(config: {
  accessToken: string;
  dataCenter: ZohoDataCenter;
  fetchImpl?: typeof fetch;
}): ZohoVaultClient {
  const api = createZohoApiClient({
    ...serviceClientParts("vault", config.dataCenter),
    accessToken: config.accessToken,
    fetchImpl: config.fetchImpl,
  });
  const enc = (v: string) => encodeURIComponent(v);

  return {
    listSecrets: (options = {}) =>
      api.get("/secrets", {
        query: {
          ...(options.searchTerm === undefined ? {} : { SEARCH_TERM: options.searchTerm }),
          ...(options.chamberId === undefined ? {} : { CHAMBER_ID: options.chamberId }),
        },
      }),

    getSecret: (secretId) =>
      // **`isSecretDataRequired` を真にしないと中身が返りません。**
      // 既定は名前だけ——**「取れない」と悩む原因**になるので明示します。
      api.get(`/secrets/${enc(secretId)}`, {
        query: { isSecretDataRequired: "true" },
      }),
  };
}
