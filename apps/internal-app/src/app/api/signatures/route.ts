/** 手書きサイン: 一覧(GET ?subjectType=&subjectId=)・保存(POST)。認証ユーザー。 */
import { withApiObservability } from "../../../server/instrument.js";
import { currentUser } from "../../../server/authorize.js";
import { serverEnv } from "../../../server/env.js";
import { signatureStore, auditActions } from "../../../server/platform-services.js";
import { isValidSignatureImage } from "../../../server/signature-repo.js";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });
  const q = new URL(req.url).searchParams;
  const subjectType = q.get("subjectType") ?? "";
  const subjectId = q.get("subjectId") ?? "";
  if (!subjectType || !subjectId) return Response.json({ error: "subjectType と subjectId が必要です" }, { status: 400 });
  return Response.json({ signatures: await signatureStore.list(subjectType, subjectId) });
}

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });
  const body = (await req.json()) as { subjectType?: string; subjectId?: string; image?: string };
  if (!body.subjectType || !body.subjectId || !body.image) return Response.json({ error: "対象と署名画像が必要です" }, { status: 400 });
  if (!isValidSignatureImage(body.image)) return Response.json({ error: "署名画像が不正です（PNG のみ・空署名は不可）" }, { status: 400 });
  const sig = await signatureStore.save({ subjectType: body.subjectType, subjectId: body.subjectId, signer: user.email, image: body.image });
  await auditActions.record(user.email, "signature.save", `${body.subjectType}:${body.subjectId}`, {});
  return Response.json({ id: sig.id, signedAt: sig.signedAt }, { status: 201 });
}

export const GET = withApiObservability("/api/signatures", handleGET);
export const POST = withApiObservability("/api/signatures", handlePOST);
