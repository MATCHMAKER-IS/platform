/** 承認の署名: 状況取得(GET)・署名保存(POST)。承認に紐づく手書きサインを扱う。認証ユーザー。 */
import { withApiObservability } from "../../../../../../server/instrument.js";
import { currentUser } from "../../../../../../server/authorize.js";
import { serverEnv } from "../../../../../../server/env.js";
import { signatureStore, settingsStore, auditActions } from "../../../../../../server/platform-services.js";
import { isValidSignatureImage } from "../../../../../../server/signature-repo.js";
import { approvalSubjectId, approvalSignatureStatus, canFinalizeApproval, signatureRequiredByAmount } from "../../../../../../server/approval-signature.js";

async function handleGET(req: Request, ctx: { params: Promise<{ docType: string; docNumber: string }> }): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });
  const { docType, docNumber } = await ctx.params;
  const url = new URL(req.url);
  const amount = Number(url.searchParams.get("amount") ?? "0");
  const threshold = (await settingsStore.get()).signatureThreshold;
  const required = url.searchParams.get("required") === "1" || signatureRequiredByAmount(amount, threshold);
  const signatures = await signatureStore.list("approval", approvalSubjectId(docType, docNumber));
  return Response.json({ status: approvalSignatureStatus(required, signatures), canFinalize: canFinalizeApproval(required, signatures), signatures });
}

async function handlePOST(req: Request, ctx: { params: Promise<{ docType: string; docNumber: string }> }): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });
  const { docType, docNumber } = await ctx.params;
  const body = (await req.json()) as { image?: string };
  if (!body.image || !isValidSignatureImage(body.image)) return Response.json({ error: "署名画像が不正です" }, { status: 400 });
  const sig = await signatureStore.save({ subjectType: "approval", subjectId: approvalSubjectId(docType, docNumber), signer: user.email, image: body.image });
  await auditActions.record(user.email, "approval.sign", `${docType}:${docNumber}`, {});
  return Response.json({ id: sig.id, signedAt: sig.signedAt }, { status: 201 });
}

export const GET = withApiObservability("/api/approvals/[docType]/[docNumber]/signatures", handleGET);
export const POST = withApiObservability("/api/approvals/[docType]/[docNumber]/signatures", handlePOST);
