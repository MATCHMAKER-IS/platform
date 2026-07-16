/**
 * ログイン監査サービス。基盤 `@platform/session` の createLoginAudit を、
 * AuditLog テーブルを sink にして具体化する。ログイン/ログアウト/失敗/ロック等を標準スキーマで記録。
 */
import { createLoginAudit, type LoginAuditEvent } from "@platform/session";
import { db, log } from "./services";

/** AuditLog テーブルへ書き込む監査ロガー。 */
export const loginAudit = createLoginAudit({
  async record(event: LoginAuditEvent) {
    try {
      await db.auditLog.create({
        data: {
          actor: event.subject ?? "(unknown)",
          action: event.event,
          target: "auth",
          metadata: event as unknown as object,
        },
      });
    } catch (e) {
      // 監査書き込みの失敗で本処理を止めない(ログには残す)
      log.warn("login audit の記録に失敗しました", { error: String(e) });
    }
  },
});

/** リクエストから IP と User-Agent を取り出す補助。 */
export function auditContext(req: Request): { ip?: string; userAgent?: string } {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
  const userAgent = req.headers.get("user-agent") || undefined;
  return { ...(ip ? { ip } : {}), ...(userAgent ? { userAgent } : {}) };
}
