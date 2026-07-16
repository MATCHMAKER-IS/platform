/** メールボックス: 内部連絡の送信(POST)。宛先の受信箱に届く（アプリ内メール）。 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser } from "../../../../server/authorize";
import { serverEnv } from "../../../../server/env";
import { appMailer } from "../../../../server/platform-services";
import { isValidEmail } from "@platform/mail";

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });
  const body = (await req.json()) as { to: string; subject: string; body: string };
  const recipients = (body.to ?? "").split(/[,;\s]+/).filter(Boolean);
  if (recipients.length === 0 || recipients.some((r) => !isValidEmail(r))) return Response.json({ error: "有効な宛先メールアドレスを入力してください" }, { status: 400 });
  if (!body.subject) return Response.json({ error: "件名を入力してください" }, { status: 400 });
  const res = await appMailer.sendMail({ to: recipients, from: user.email, subject: body.subject, text: body.body ?? "" });
  if (!res.ok) return Response.json({ error: "送信に失敗しました" }, { status: 500 });
  return Response.json({ sent: recipients.length }, { status: 201 });
}

export const POST = withApiObservability("/api/mailbox/send", handlePOST);
