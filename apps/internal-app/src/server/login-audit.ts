/**
 * ログイン監査サービス。基盤 `@platform/session` の createLoginAudit を、
 * AuditLog テーブルを sink にして具体化する。ログイン/ログアウト/失敗/ロック等を標準スキーマで記録。
 */
import { metrics } from "./observability";
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
      // **pino 流儀: (obj, msg) の順。** メッセージを第 1 引数に書くと型が合わない
      log.warn({ error: String(e) }, "login audit の記録に失敗しました");
      // **メトリクスにも載せる。** 2026-08 までログだけで、
      // **監査ログが欠けても気づけなかった**——「誰がいつログインしたか」を
      // 後から追えなくなる。**欠けたこと自体が記録に残らない**のが問題で、
      // 監査のときに「記録が無い＝ログインしていない」と誤読される
      metrics.incrementCounter("audit.write_failed", 1, { kind: "login" });
    }
  },
});

/** リクエストから IP と User-Agent を取り出す補助。 */
export function auditContext(req: Request): { ip?: string; userAgent?: string } {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
  const userAgent = req.headers.get("user-agent") || undefined;
  return { ...(ip ? { ip } : {}), ...(userAgent ? { userAgent } : {}) };
}
