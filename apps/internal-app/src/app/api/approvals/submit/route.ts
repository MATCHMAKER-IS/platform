/** 伝票承認: 発注・請求を金額別ルートで申請(POST)。docType に応じ purchase:write / invoice:write。 */
import { withApiObservability } from "../../../../server/instrument.js";
import { currentUser, requirePermission } from "../../../../server/authorize.js";
import { serverEnv } from "../../../../server/env.js";
import { docApprovalStore, auditActions } from "../../../../server/platform-services.js";
import { type DocType } from "../../../../server/doc-approval-repo.js";

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  const body = (await req.json()) as { docType: DocType; docNumber: string; amount: number };
  if (!["purchase", "invoice"].includes(body.docType) || !body.docNumber || !(body.amount > 0)) return Response.json({ error: "docType(purchase/invoice)・docNumber・正の金額が必要です" }, { status: 400 });
  requirePermission(user, body.docType === "invoice" ? "invoice:write" : "purchase:write");
  const approval = await docApprovalStore.submit(body.docType, body.docNumber, body.amount);
  await auditActions.record(user!.email, "approval.submit", `${body.docType}:${body.docNumber}`, { after: { amount: body.amount, steps: approval.totalSteps } });
  return Response.json(approval, { status: 201 });
}

export const POST = withApiObservability("/api/approvals/submit", handlePOST);
