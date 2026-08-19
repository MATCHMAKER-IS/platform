/** 自分のダイジェスト頻度の取得(GET)・設定(PUT)。認証ユーザー。 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser } from "../../../../server/authorize";
import "../../../../server/env";
import { digestSettingStore } from "../../../../server/platform-services";
import { type DigestFrequency } from "../../../../server/digest";
import { validate, z } from "@platform/validation";

const DigestInput = z.object({ frequency: z.enum(["daily", "weekly", "off"]).default("off") });

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req);
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });
  return Response.json({ setting: await digestSettingStore.get(user.email) });
}

async function handlePUT(req: Request): Promise<Response> {
  const user = currentUser(req);
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });
  const parsed = validate(DigestInput, await req.json().catch(() => ({})));
  const frequency: DigestFrequency = parsed.ok ? parsed.value.frequency : "off";
  const current = await digestSettingStore.get(user.email);
  await digestSettingStore.set(user.email, { frequency, ...(current.lastSentAt ? { lastSentAt: current.lastSentAt } : {}) });
  return Response.json({ setting: await digestSettingStore.get(user.email) });
}

export const GET = withApiObservability("/api/notifications/digest", handleGET);
export const PUT = withApiObservability("/api/notifications/digest", handlePUT);
