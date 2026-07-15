/** お問い合わせ: 送信(POST・要ログイン)・一覧(GET・inquiry:read)。送信時は管理者の受信箱にも届く。 */
import { withApiObservability } from "../../../server/instrument.js";
import { currentUser, requirePermission } from "../../../server/authorize.js";
import { serverEnv } from "../../../server/env.js";
import { inquiryStore, appMailer } from "../../../server/platform-services.js";
import { isValidEmail } from "@platform/mail";

const INQUIRY_MAILBOX = "support@example.com";

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });
  const body = (await req.json()) as { name: string; email: string; category: string; subject: string; message: string };
  if (!body.name || !body.subject || !body.message) return Response.json({ error: "氏名・件名・本文は必須です" }, { status: 400 });
  if (!body.email || !isValidEmail(body.email)) return Response.json({ error: "有効なメールアドレスを入力してください" }, { status: 400 });
  const inquiry = await inquiryStore.submit({ name: body.name, email: body.email, category: body.category || "一般", subject: body.subject, message: body.message });
  await appMailer.sendMail({ to: INQUIRY_MAILBOX, from: body.email, subject: `【お問い合わせ】${body.subject}`, text: `カテゴリ: ${inquiry.category}\n氏名: ${body.name}\nメール: ${body.email}\n\n${body.message}` });
  return Response.json({ id: inquiry.id }, { status: 201 });
}

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "inquiry:read");
  const status = new URL(req.url).searchParams.get("status");
  const list = status === "new" || status === "in_progress" || status === "closed" ? await inquiryStore.list(status) : await inquiryStore.list();
  return Response.json({ inquiries: list, open: await inquiryStore.openCount() });
}

export const POST = withApiObservability("/api/inquiries", handlePOST);
export const GET = withApiObservability("/api/inquiries", handleGET);
