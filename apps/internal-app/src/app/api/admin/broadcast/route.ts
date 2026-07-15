/** 管理: 全体周知の配信(POST)。有効な全利用者の受信箱へ一斉送信。管理者のみ。 */
import { withApiObservability } from "../../../../server/instrument.js";
import { currentUser } from "../../../../server/authorize.js";
import { serverEnv } from "../../../../server/env.js";
import { userStore, appMailer, auditActions } from "../../../../server/platform-services.js";
import { activeRecipients } from "../../../../server/broadcast.js";

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  if (!user || !user.roles.includes("admin")) return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  const body = (await req.json()) as { subject: string; body: string };
  if (!body.subject || !body.body) return Response.json({ error: "件名と本文が必要です" }, { status: 400 });
  const recipients = activeRecipients(await userStore.list());
  if (recipients.length === 0) return Response.json({ error: "配信対象の利用者がいません" }, { status: 400 });
  const res = await appMailer.sendMail({ to: recipients, from: user.email, subject: `[お知らせ] ${body.subject}`, text: body.body });
  if (!res.ok) return Response.json({ error: "配信に失敗しました" }, { status: 500 });
  await auditActions.record(user.email, "broadcast.send", `count:${recipients.length}`, { after: { recipients: recipients.length } });
  return Response.json({ delivered: recipients.length }, { status: 201 });
}

export const POST = withApiObservability("/api/admin/broadcast", handlePOST);
