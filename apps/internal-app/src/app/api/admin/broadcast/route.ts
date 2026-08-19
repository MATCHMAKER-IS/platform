/** 管理: 全体周知の配信(POST)。有効な全利用者の受信箱へ一斉送信。管理者のみ。 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser } from "../../../../server/authorize";
import "../../../../server/env";
import { userStore, appMailer, auditActions } from "../../../../server/platform-services";
import { activeRecipients } from "../../../../server/broadcast";

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req);
  if (!user || !user.roles.includes("admin")) return Response.json({ error: "管理者権限が必要です。必要な場合は管理者に依頼してください" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { subject: string; body: string };
  if (!body.subject || !body.body) return Response.json({ error: "件名と本文が必要です" }, { status: 400 });
  const recipients = activeRecipients(await userStore.list());
  if (recipients.length === 0) return Response.json({ error: "配信対象の利用者がいません" }, { status: 400 });
  // **`to` に全員を入れない。** 入れると**受信者全員に全員のアドレスが見える**
  // ——社内のお知らせでも「誰に送ったか」が全員に分かるのは望ましくないし、
  // 社外へ送る仕組みに転用されれば**そのまま個人情報の漏洩事故**になる。
  // `to` は送信者本人にして、実際の宛先は `bcc` に入れる(2026-08 に修正)。
  // `to` を空にすると受信側で迷惑メール判定されやすいので、必ず何か入れる。
  const res = await appMailer.sendMail({
    to: user.email,
    bcc: recipients,
    from: user.email,
    subject: `[お知らせ] ${body.subject}`,
    text: body.body,
  });
  if (!res.ok) return Response.json({ error: "配信に失敗しました" }, { status: 500 });
  await auditActions.record(user.email, "broadcast.send", `count:${recipients.length}`, { after: { recipients: recipients.length } });
  return Response.json({ delivered: recipients.length }, { status: 201 });
}

export const POST = withApiObservability("/api/admin/broadcast", handlePOST);
