// public-api: 稼働状況の公開。障害時に社外からも見える必要がある
/** 統合ステータス(GET)。DB・外部連携・Webhook等の稼働状況を集約。認証不要（表示用の要約）。 */
import { runHealthChecks } from "@platform/observability";
import { db } from "../../../server/services";
import { sql, queryRaw } from "@platform/db";
import { zohoBreakerState } from "../../../server/zoho-client";
import { webhookSubscriptionStore } from "../../../server/platform-services";
import { buildStatusChecks, summarizeStatus } from "../../../server/status-checks";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const checks = buildStatusChecks({
    checkDb: async () => { const r = await queryRaw(db, sql`SELECT 1`); if (!r.ok) throw new Error("DB 到達不可"); },
    checkZoho: async () => { if (zohoBreakerState() === "open") throw new Error("Zoho サーキット開放中"); },
    checkWebhooks: async () => { await webhookSubscriptionStore.list(); },
  });
  const report = await runHealthChecks(checks, { timeoutMs: 2000 });
  return Response.json({ ...report, summary: summarizeStatus(report) }, { status: report.status === "healthy" ? 200 : 503 });
}
