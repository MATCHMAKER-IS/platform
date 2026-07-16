/** 伝票承認: 種別ごとの承認状況マップ(GET)。発注・請求一覧のバッジ表示用。?docType=purchase|invoice。閲覧は各伝票のread。 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../server/authorize";
import { serverEnv } from "../../../../server/env";
import { docApprovalStore } from "../../../../server/platform-services";
import { type DocType } from "../../../../server/doc-approval-repo";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  const docType = (new URL(req.url).searchParams.get("docType") ?? "purchase") as DocType;
  if (!["purchase", "invoice"].includes(docType)) return Response.json({ error: "docType は purchase か invoice" }, { status: 400 });
  requirePermission(user, docType === "invoice" ? "invoice:read" : "purchase:read");
  const list = await docApprovalStore.listByType(docType);
  const statuses: Record<string, { status: string; currentStep: number; totalSteps: number }> = {};
  for (const a of list) statuses[a.docNumber] = { status: a.status, currentStep: a.currentStep, totalSteps: a.totalSteps };
  return Response.json({ docType, statuses });
}

export const GET = withApiObservability("/api/approvals/status", handleGET);
