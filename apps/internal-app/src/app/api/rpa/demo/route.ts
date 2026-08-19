/** RPA デモ実行(POST・管理者)+監査イベント取得(GET)。ランナーの直列化/リトライ/冪等/監査を体感する。 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../server/authorize";
import "../../../../server/env";
import { runDemoPointSync, getRecentRpaEvents } from "../../../../server/rpa-service";
import { validate, z } from "@platform/validation";

const DemoInput = z.object({ fail: z.boolean().optional(), idempotencyKey: z.string().max(200).optional() });

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req);
  try {
    requirePermission(user, "system:manage");
  } catch {
    return Response.json({ error: "管理者権限が必要です。必要な場合は管理者に依頼してください" }, { status: 403 });
  }
  const parsed = validate(DemoInput, await req.json().catch(() => ({})));
  if (!parsed.ok) {
    return Response.json({ error: parsed.error.message, details: parsed.error.details }, { status: 400 });
  }
  const body = parsed.value;
  const r = await runDemoPointSync({ ...(body.fail ? { fail: true } : {}), ...(body.idempotencyKey ? { idempotencyKey: body.idempotencyKey } : {}) });
  if (!r.ok) return Response.json({ error: r.error, code: r.code }, { status: 200 });
  return Response.json({ result: { rows: r.rows, attempts: r.attempts, skipped: r.skipped } });
}

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req);
  try {
    requirePermission(user, "system:manage");
  } catch {
    return Response.json({ error: "管理者権限が必要です。必要な場合は管理者に依頼してください" }, { status: 403 });
  }
  return Response.json({ events: getRecentRpaEvents(50) });
}

export const POST = withApiObservability("/api/rpa/demo", handlePOST);
export const GET = withApiObservability("/api/rpa/demo", handleGET);
