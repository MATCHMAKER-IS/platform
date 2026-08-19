/** AI 利用状況(GET)。累計コスト・トークン・利用者別・直近ログ。管理者のみ。 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../server/authorize";
import "../../../../server/env";
import { aiLogStore, aiIsMock } from "../../../../server/ai-gateway";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req);
  try {
    requirePermission(user, "system:manage");
  } catch {
    return Response.json({ error: "管理者権限が必要です。必要な場合は管理者に依頼してください" }, { status: 403 });
  }
  const totals = aiLogStore.totals();
  const recent = aiLogStore.list().slice(-20).reverse().map((e) => ({ at: e.at, model: e.model, user: e.user, ok: e.ok, latencyMs: e.latencyMs, costJpy: e.costJpy ?? null, error: e.error }));
  return Response.json({ totals, recent, mock: aiIsMock });
}

export const GET = withApiObservability("/api/ai/usage", handleGET);
