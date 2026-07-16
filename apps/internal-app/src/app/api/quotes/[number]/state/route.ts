/** 見積: 状態遷移(POST)。quote:write が必要。 */
import { withApiObservability } from "../../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../../server/authorize";
import { serverEnv } from "../../../../../server/env";
import { quoteStore, auditActions } from "../../../../../server/platform-services";
import { type QuoteState } from "../../../../../server/quote-repo";

async function handlePOST(req: Request, ctx: { params: Promise<{ number: string }> }): Promise<Response> {
  const { number } = await ctx.params;
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "quote:write");
  const body = (await req.json()) as { state: QuoteState };
  if (!["draft", "sent", "accepted", "rejected"].includes(body.state)) return Response.json({ error: "state が不正です" }, { status: 400 });
  const view = await quoteStore.setState(number, body.state);
  if (!view) return Response.json({ error: "見積が見つかりません" }, { status: 404 });
  await auditActions.record(user!.email, "quote.state", `quote:${number}`, { after: { state: body.state } });
  return Response.json(view);
}

export const POST = withApiObservability("/api/quotes/[number]/state", handlePOST);
