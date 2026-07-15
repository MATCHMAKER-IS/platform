/** メールボックス: 既読化(POST)。自分宛のメッセージのみ既読にできる。 */
import { withApiObservability } from "../../../../server/instrument.js";
import { currentUser } from "../../../../server/authorize.js";
import { serverEnv } from "../../../../server/env.js";
import { mailboxStore } from "../../../../server/platform-services.js";

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });
  const body = (await req.json()) as { id: string };
  if (!body.id) return Response.json({ error: "id が必要です" }, { status: 400 });
  const msg = await mailboxStore.get(body.id);
  if (!msg || msg.owner !== user.email) return Response.json({ error: "メッセージが見つかりません" }, { status: 404 });
  await mailboxStore.markRead(body.id);
  return Response.json({ id: body.id, read: true });
}

export const POST = withApiObservability("/api/mailbox/read", handlePOST);
