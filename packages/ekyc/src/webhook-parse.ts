/**
 * eKYC の Webhook 本文を**解析する**部分。
 *
 * 【なぜ署名の検証と分けているか】
 * 検証は `node:crypto`（HMAC）を使うので、**ブラウザや Edge では動きません**。
 * 一方この解析は**文字列を読むだけ**で、どこでも動きます。
 *
 * 同じファイルに置くと、**解析したいだけの画面が `node:crypto` を巻き込み**、
 * `next build` が落ちます（`UnhandledSchemeError`。2026-08）。
 * **「純粋かどうか」はファイル単位で決まります**——関数単位ではありません。
 *
 * 検証は `@platform/ekyc` の `verifyEkycSignature` を**サーバで**使ってください。
 *
 * @packageDocumentation
 */
import { normalizeEkycStatus, type EkycStatus } from "./status";

export interface EkycWebhookEvent {
  /** ベンダー発行の申込 ID。 */
  applicationId?: string;
  /** 正規化ステータス。 */
  status: EkycStatus;
  /** 生のステータス文字列。 */
  rawStatus?: string;
  /** 却下理由等。 */
  reason?: string;
  /** イベント全体(ベンダー固有フィールドを参照する用)。 */
  raw: Record<string, unknown>;
}

/** 正規化された eKYC Webhook イベント。 */
export interface EkycWebhookEvent {
  /** ベンダー発行の申込 ID。 */
  applicationId?: string;
  /** 正規化ステータス。 */
  status: EkycStatus;
  /** 生のステータス文字列。 */
  rawStatus?: string;
  /** 却下理由等。 */
  reason?: string;
  /** イベント全体(ベンダー固有フィールドを参照する用)。 */
  raw: Record<string, unknown>;
}

/**
 * Webhook ボディをパースして正規化イベントにする。
 * フィールド名はベンダーで異なるため、抽出関数で調整できる(既定は一般的な名前を探す)。
 *
 * @param body リクエストボディ
 * @param options 項目名の対応（**ベンダーごとに違う**）
 * @returns イベント。**解析できなくても例外を投げない**(status は `unknown` になる)。
 *
 * @remarks
 * **署名を通しても、同じ要求は何度でも送り直せる。**
 * 通信路を見られる立場なら、**「本人確認 完了」の通知を再送**できる
 * ——期限切れにしたはずの承認が復活する。
 * `idField` で取り出したイベント ID を `@platform/webhook` の冪等ストアに記録し、
 * **2 回目は処理せず 200 を返す**こと(2026-08 に明記)。
 *
 * **この関数は署名を検証しない。** 先に {@link verifyEkycSignature} を通すこと——
 * 通さないと、**誰でも「本人確認が完了した」という Webhook を送れる**。
 * eKYC の結果は口座開設や与信の判断に使うので、**なりすましがそのまま通る**。
 *
 * ```ts
 * if (!verifyEkycSignature(body, signature, secret)) {
 *   return new Response("invalid signature", { status: 401 });
 * }
 * const event = parseEkycWebhook(body);
 * ```
 *
 * webhook の入口で throw すると 500 が返り、**ベンダーがリトライを繰り返す**
 * (壊れたボディは何度送っても壊れている)。200 で受けてログに残すのが正しい。
 * ただし**署名の不一致は 401 で返す**——それは「壊れたボディ」ではなく
 * 「送り主が違う」ので、リトライさせる意味がない。
 */
export function parseEkycWebhook(
  body: string,
  options?: {
    idField?: string;
    statusField?: string;
    reasonField?: string;
    statusMapping?: Record<string, EkycStatus>;
  },
): EkycWebhookEvent {
  // **例外を投げない。** webhook の入口で throw すると 500 が返り、
  // ベンダーがリトライを繰り返す(壊れたボディは何度送っても壊れている)。
  let raw: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(body);
    raw = parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    raw = {};
  }
  const pick = (obj: Record<string, unknown>, names: string[]): unknown => {
    for (const n of names) if (obj[n] !== undefined) return obj[n];
    return undefined;
  };
  const idField = options?.idField;
  const statusField = options?.statusField;
  const applicationId = (idField ? raw[idField] : pick(raw, ["application_id", "applicationId", "id", "verification_id"])) as string | undefined;
  const rawStatus = (statusField ? raw[statusField] : pick(raw, ["status", "result", "state"])) as string | undefined;
  const reason = (options?.reasonField ? raw[options.reasonField] : pick(raw, ["reason", "message", "detail"])) as string | undefined;
  return {
    ...(applicationId ? { applicationId } : {}),
    status: normalizeEkycStatus(rawStatus, options?.statusMapping),
    ...(rawStatus ? { rawStatus } : {}),
    ...(reason ? { reason } : {}),
    raw,
  };
}
