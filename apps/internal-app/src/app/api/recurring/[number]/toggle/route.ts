/** 繰り返し請求: 有効/停止の切替(POST)。invoice:write。 */
import { withApiObservability } from "../../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../../server/authorize";
import "../../../../../server/env";
import { recurringStore, auditActions } from "../../../../../server/platform-services";

async function handlePOST(req: Request, ctx: { params: Promise<{ number: string }> }): Promise<Response> {
  const { number } = await ctx.params;
  const user = currentUser(req);
  requirePermission(user, "invoice:write");
  const body = (await req.json().catch(() => ({}))) as { active: boolean };
  const view = await recurringStore.setActive(number, !!body.active);
  if (!view) return Response.json({ error: "プランが見つかりません" }, { status: 404 });
  await auditActions.record(user!.email, "recurring.toggle", `plan:${number}`, { after: { active: view.active } });
  return Response.json(view);
}

export const POST = withApiObservability("/api/recurring/[number]/toggle", handlePOST);
