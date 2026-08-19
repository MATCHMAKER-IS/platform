/** メールボックス: 内部連絡の送信(POST)。宛先の受信箱に届く（アプリ内メール）。 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser } from "../../../../server/authorize";
import "../../../../server/env";
import { appMailer } from "../../../../server/platform-services";
import { isValidEmail } from "@platform/mail";

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req);
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { to: string; subject: string; body: string };
  const recipients = (body.to ?? "").split(/[,;\s]+/).filter(Boolean);
  if (recipients.length === 0 || recipients.some((r) => !isValidEmail(r))) return Response.json({ error: "有効な宛先メールアドレスを入力してください" }, { status: 400 });
  if (!body.subject) return Response.json({ error: "件名を入力してください" }, { status: 400 });
  // **1 件ずつ送る。** 他の内部メール経路(report-scan・survey remind 等)と
  // 揃える(2026-08)。1 件でも失敗したら全体を失敗として扱う——
  // 「一部だけ送れた」を利用者に伝える手段が今の応答形式には無いため。
  for (const to of recipients) {
    const res = await appMailer.sendMail({ to, from: user.email, subject: body.subject, text: body.body ?? "" });
    if (!res.ok) return Response.json({ error: "送信に失敗しました" }, { status: 500 });
  }
  return Response.json({ sent: recipients.length }, { status: 201 });
}

export const POST = withApiObservability("/api/mailbox/send", handlePOST);
