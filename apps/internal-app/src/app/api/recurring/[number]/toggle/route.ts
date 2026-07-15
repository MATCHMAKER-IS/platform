/** 繰り返し請求: 有効/停止の切替(POST)。invoice:write。 */
import { withApiObservability } from "../../../../../server/instrument.js";
import { currentUser, requirePermission } from "../../../../../server/authorize.js";
import { serverEnv } from "../../../../../server/env.js";
import { recurringStore, auditActions } from "../../../../../server/platform-services.js";

async function handlePOST(req: Request, ctx: { params: Promise<{ number: string }> }): Promise<Response> {
  const { number } = await ctx.params;
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "invoice:write");
  const body = (await req.json()) as { active: boolean };
  const view = await recurringStore.setActive(number, !!body.active);
  if (!view) return Response.json({ error: "プランが見つかりません" }, { status: 404 });
  await auditActions.record(user!.email, "recurring.toggle", `plan:${number}`, { after: { active: view.active } });
  return Response.json(view);
}

export const POST = withApiObservability("/api/recurring/[number]/toggle", handlePOST);
