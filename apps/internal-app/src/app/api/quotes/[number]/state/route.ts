/** 見積: 状態遷移(POST)。quote:write が必要。 */
import { withApiObservability } from "../../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../../server/authorize";
import "../../../../../server/env";
import { quoteStore, auditActions } from "../../../../../server/platform-services";
import { type QuoteState } from "../../../../../server/quote-repo";
import { validate, z } from "@platform/validation";

const StateInput = z.object({ state: z.enum(["draft", "sent", "accepted", "rejected"]) });

async function handlePOST(req: Request, ctx: { params: Promise<{ number: string }> }): Promise<Response> {
  const { number } = await ctx.params;
  const user = currentUser(req);
  requirePermission(user, "quote:write");
  const parsed = validate(StateInput, await req.json().catch(() => ({})));
  if (!parsed.ok) {
    return Response.json({ error: parsed.error.message, details: parsed.error.details }, { status: 400 });
  }
  const view = await quoteStore.setState(number, parsed.value.state as QuoteState);
  if (!view) return Response.json({ error: "見積が見つかりません" }, { status: 404 });
  await auditActions.record(user!.email, "quote.state", `quote:${number}`, { after: { state: parsed.value.state } });
  return Response.json(view);
}

export const POST = withApiObservability("/api/quotes/[number]/state", handlePOST);
