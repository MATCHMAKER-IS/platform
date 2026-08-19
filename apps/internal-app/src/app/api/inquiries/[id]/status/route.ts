/** お問い合わせ: 対応状況の更新(POST)。inquiry:write。 */
import { withApiObservability } from "../../../../../server/instrument";
import { validate, z } from "@platform/validation";

/**
 * ステータス変更の入力。
 *
 * **`normalizeStatus` は未知の値を黙って `new` に落とす。**
 * 綴りを間違えて「対応済」にしたつもりが、**未対応に戻る**——
 * しかもエラーにならないので、画面を見るまで気づけない。
 * ここで弾けば「不正な値です」と返せる。
 */
const StatusInput = z.object({ status: z.enum(["new", "in_progress", "closed"]) });
import { currentUser, requirePermission } from "../../../../../server/authorize";
import "../../../../../server/env";
import { inquiryStore, auditActions } from "../../../../../server/platform-services";

async function handlePOST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  const user = currentUser(req);
  requirePermission(user, "inquiry:write");
  const parsed = validate(StatusInput, await req.json().catch(() => ({})));
  if (!parsed.ok) {
    return Response.json({ error: parsed.error.message, details: parsed.error.details }, { status: 400 });
  }
  const status = parsed.value.status;
  const existing = await inquiryStore.get(id);
  if (!existing) return Response.json({ error: "お問い合わせが見つかりません" }, { status: 404 });
  await inquiryStore.setStatus(id, status);
  await auditActions.record(user!.email, "inquiry.status", `inquiry:${id}`, { after: { status } });
  return Response.json({ id, status });
}

export const POST = withApiObservability("/api/inquiries/[id]/status", handlePOST);
