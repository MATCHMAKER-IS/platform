/** レポートプリセットの一覧(GET)・追加/削除(POST)。認証ユーザー（自分のプリセット）。 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser } from "../../../../server/authorize";
import "../../../../server/env";
import { reportPresetStore } from "../../../../server/platform-services";
import { validate, z } from "@platform/validation";

const PresetInput = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("add"),
    name: z.string().trim().min(1).max(100),
    reportType: z.enum(["sales", "receivables", "inventory"]),
    from: z.string().optional(),
    to: z.string().optional(),
    partner: z.string().optional(),
  }),
  z.object({ op: z.literal("remove"), id: z.string().min(1) }),
]);

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req);
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });
  return Response.json({ presets: await reportPresetStore.list(user.email) });
}

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req);
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });
  const parsed = validate(PresetInput, await req.json().catch(() => ({})));
  if (!parsed.ok) {
    return Response.json({ error: parsed.error.message, details: parsed.error.details }, { status: 400 });
  }
  const body = parsed.value;
  if (body.op === "add") {
    const p = await reportPresetStore.add(user.email, { name: body.name, reportType: body.reportType, ...(body.from ? { from: body.from } : {}), ...(body.to ? { to: body.to } : {}), ...(body.partner ? { partner: body.partner } : {}) });
    return Response.json({ id: p.id }, { status: 201 });
  }
  await reportPresetStore.remove(user.email, body.id);
  return Response.json({ id: body.id, removed: true });
}

export const GET = withApiObservability("/api/reports/presets", handleGET);
export const POST = withApiObservability("/api/reports/presets", handlePOST);
