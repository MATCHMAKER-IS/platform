/** 公開サイト: お問い合わせ受付(POST)。社内アプリのインテークAPIへ転送して受信一覧に集約する。 */
import { siteEnv } from "../../../server/env";
async function handlePOST(req: Request): Promise<Response> {
  const body = (await req.json()) as { name?: string; email?: string; category?: string; subject?: string; message?: string };
  if (!body.name || !body.email || !body.subject || !body.message) return Response.json({ error: "必須項目を入力してください。" }, { status: 400 });
  const intakeUrl = siteEnv.INTERNAL_INQUIRY_URL;
  const token = siteEnv.INQUIRY_INTAKE_TOKEN;
  if (!intakeUrl || !token) return Response.json({ error: "受付設定が未構成です。" }, { status: 503 });
  try {
    const res = await fetch(intakeUrl, { method: "POST", headers: { "Content-Type": "application/json", "X-Intake-Token": token }, body: JSON.stringify(body) });
    if (!res.ok) return Response.json({ error: "受付に失敗しました。" }, { status: 502 });
    return Response.json({ ok: true }, { status: 201 });
  } catch {
    return Response.json({ error: "受付に失敗しました。" }, { status: 502 });
  }
}

export const POST = handlePOST;
