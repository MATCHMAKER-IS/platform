/** 伝票承認: 承認/却下(POST)。approval:decide。段ごとの承認ロール(manager→finance→admin)で権限分掌。 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../server/authorize";
import { serverEnv } from "../../../../server/env";
import { docApprovalStore, auditActions } from "../../../../server/platform-services";
import { type DocType } from "../../../../server/doc-approval-repo";

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "approval:decide");
  const body = (await req.json()) as { docType: DocType; docNumber: string; action: "approve" | "reject"; reason?: string };
  if (!["purchase", "invoice"].includes(body.docType) || !body.docNumber || !["approve", "reject"].includes(body.action)) return Response.json({ error: "docType・docNumber・action(approve/reject)が必要です" }, { status: 400 });
  if (body.action === "reject" && !body.reason) return Response.json({ error: "却下には理由が必要です" }, { status: 400 });
  // 管理者は全ステップを承認できるよう manager/finance ロールを補完（一般の承認者は自ロールの段のみ）
  const roles = user!.roles.includes("admin") ? Array.from(new Set([...user!.roles, "manager", "finance"])) : user!.roles;
  const actor = { id: user!.email, roles };
  const result = await docApprovalStore.decide(body.docType, body.docNumber, actor, body.action, body.reason);
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
  await auditActions.record(user!.email, `approval.${body.action}`, `${body.docType}:${body.docNumber}`, { after: { status: result.approval.status, step: result.approval.currentStep } });
  return Response.json(result.approval);
}

export const POST = withApiObservability("/api/approvals/decision", handlePOST);
