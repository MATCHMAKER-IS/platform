// public-api: 死活監視。監視システムから認可なしで叩けることが要件
// no-rate-limit: 死活監視は数十秒ごとに叩かれるのが要件。制限すると監視そのものが落ちる
/**
 * ヘルスチェック(liveness/readiness)。DB 等の依存を集約し 200/503 を返す。
 */
import { runHealthChecks, type HealthCheck } from "@platform/observability";
import { db } from "../../../server/services";
import { sql, queryRaw } from "@platform/db";
import { zohoBreakerState } from "../../../server/zoho-client";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const readiness = new URL(req.url).searchParams.get("type") !== "live";
  // **型を明示する。** 三項で `{...} | {}` の union になると
  // `Record<string, HealthCheck>` に代入できない(空側のキーが undefined 扱いになる)
  const checks: Record<string, HealthCheck> = readiness
    ? {
        database: async () => { const r = await queryRaw(db, sql`SELECT 1`); if (!r.ok) throw new Error("db unreachable"); },
        zoho: async () => { if (zohoBreakerState() === "open") throw new Error("zoho circuit open"); },
      }
    : {}; // liveness はプロセス生存のみ
  const report = await runHealthChecks(checks, { timeoutMs: 2000 });
  return Response.json(report, { status: report.status === "healthy" ? 200 : 503 });
}
