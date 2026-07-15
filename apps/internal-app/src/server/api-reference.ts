/**
 * 開発者向け API リファレンス。外部向け v1 API の OpenAPI 仕様と、送信 Webhook のイベントカタログを提供する。
 * @packageDocumentation
 */

/** 送信 Webhook のイベント定義。 */
export interface WebhookEventDef {
  event: string;
  description: string;
  /** ペイロード data 部の例。 */
  payloadExample: Record<string, unknown>;
}

/** 送信 Webhook で配信されるイベントの一覧。 */
export const WEBHOOK_EVENTS: WebhookEventDef[] = [
  { event: "invoice.created", description: "請求書が作成されたとき", payloadExample: { number: "INV-0001", billTo: "株式会社サンプル" } },
];

/** Webhook 署名の説明（ドキュメント表示用）。 */
export const WEBHOOK_SIGNATURE_DOC = {
  header: "x-webhook-signature",
  algorithm: "HMAC-SHA256(secret, body) の16進",
  eventHeader: "x-webhook-event",
};

/** v1 API の OpenAPI 3.0 仕様を返す。 */
export function openApiSpec(serverUrl = ""): Record<string, unknown> {
  return {
    openapi: "3.0.3",
    info: { title: "社内基盤 外部API", version: "1.0.0", description: "サービスアカウント（APIキー）で認証する外部向け API。" },
    servers: [{ url: `${serverUrl}/api/v1` }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", description: "Authorization: Bearer <APIキー>（/admin/service-accounts で発行）" },
      },
      schemas: {
        Invoice: { type: "object", properties: { number: { type: "string" }, billTo: { type: "string" }, total: { type: "number" } } },
        Error: { type: "object", properties: { error: { type: "string" } } },
      },
    },
    security: [{ bearerAuth: [] }],
    paths: {
      "/invoices": {
        get: {
          summary: "請求一覧の取得",
          description: "スコープ invoice:read が必要。レート制限 100 回/分。超過時は 429。",
          security: [{ bearerAuth: [] }],
          responses: {
            "200": { description: "成功", content: { "application/json": { schema: { type: "object", properties: { account: { type: "string" }, invoices: { type: "array", items: { $ref: "#/components/schemas/Invoice" } } } } } } },
            "401": { description: "認証失敗", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "403": { description: "スコープ不足", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "429": { description: "レート制限超過" },
          },
        },
      },
    },
  };
}
