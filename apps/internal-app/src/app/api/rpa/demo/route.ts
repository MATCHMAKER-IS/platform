/** RPA デモ実行(POST・管理者)+監査イベント取得(GET)。ランナーの直列化/リトライ/冪等/監査を体感する。 */
import { withApiObservability } from "../../../../server/instrument.js";
import { currentUser, requirePermission } from "../../../../server/authorize.js";
import { serverEnv } from "../../../../server/env.js";
import { runDemoPointSync, getRecentRpaEvents } from "../../../../server/rpa-service.js";

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  try {
    requirePermission(user, "admin");
  } catch {
    return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as { fail?: boolean; idempotencyKey?: string };
  const r = await runDemoPointSync({ ...(body.fail ? { fail: true } : {}), ...(body.idempotencyKey ? { idempotencyKey: body.idempotencyKey } : {}) });
  if (!r.ok) return Response.json({ error: r.error, code: r.code }, { status: 200 });
  return Response.json({ result: { rows: r.rows, attempts: r.attempts, skipped: r.skipped } });
}

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  try {
    requirePermission(user, "admin");
  } catch {
    return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  }
  return Response.json({ events: getRecentRpaEvents(50) });
}

export const POST = withApiObservability("/api/rpa/demo", handlePOST);
export const GET = withApiObservability("/api/rpa/demo", handleGET);
