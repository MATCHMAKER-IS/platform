/** お問い合わせ: 対応状況の更新(POST)。inquiry:write。 */
import { withApiObservability } from "../../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../../server/authorize";
import { serverEnv } from "../../../../../server/env";
import { inquiryStore, auditActions } from "../../../../../server/platform-services";
import { normalizeStatus } from "../../../../../server/inquiry-repo";

async function handlePOST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "inquiry:write");
  const body = (await req.json()) as { status: string };
  const status = normalizeStatus(body.status);
  const existing = await inquiryStore.get(id);
  if (!existing) return Response.json({ error: "お問い合わせが見つかりません" }, { status: 404 });
  await inquiryStore.setStatus(id, status);
  await auditActions.record(user!.email, "inquiry.status", `inquiry:${id}`, { after: { status } });
  return Response.json({ id, status });
}

export const POST = withApiObservability("/api/inquiries/[id]/status", handlePOST);
