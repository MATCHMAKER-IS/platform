// public-api: 社外からの問い合わせ受付(公開フォーム)。レート制限で保護する
/** お問い合わせ: 匿名インテーク(POST)。公開サイトのフォームから受け付ける。X-Intake-Token で保護。 */
import { withApiObservability } from "../../../../server/instrument";
import { inquiryStore } from "../../../../server/platform-services";
import { isValidEmail } from "@platform/mail";
import { featureEnv } from "../../../../server/env";

async function handlePOST(req: Request): Promise<Response> {
  const token = featureEnv.INQUIRY_INTAKE_TOKEN;
  if (!token || req.headers.get("x-intake-token") !== token) return Response.json({ error: "不正なリクエストです" }, { status: 401 });
  const body = (await req.json()) as { name?: string; email?: string; category?: string; subject?: string; message?: string };
  if (!body.name || !body.email || !body.subject || !body.message) return Response.json({ error: "氏名・メール・件名・本文は必須です" }, { status: 400 });
  if (!isValidEmail(body.email)) return Response.json({ error: "メールアドレスが不正です" }, { status: 400 });
  const inquiry = await inquiryStore.submit({ name: body.name, email: body.email, category: body.category || "公開サイト", subject: body.subject, message: body.message });
  return Response.json({ id: inquiry.id }, { status: 201 });
}

export const POST = withApiObservability("/api/inquiries/intake", handlePOST);
