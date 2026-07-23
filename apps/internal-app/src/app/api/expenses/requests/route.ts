/** 経費申請の作成 API(POST)。 */
import { currentUser, requirePermission } from "../../../../server/authorize";
import { serverEnv } from "../../../../server/env";
import { withApiObservability } from "../../../../server/instrument";
import { createRequest } from "../../../../server/approval-repo";
import { auditActions } from "../../../../server/platform-services";

async function handlePOST(req: Request): Promise<Response> {
  // 認可: この API を叩いてよいかを最初に判定する
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "expense:create");
  let body: { applicant?: string; expenseId?: string };
  try {
    body = (await req.json()) as { applicant?: string; expenseId?: string };
  } catch {
    return new Response("JSON の解析に失敗しました", { status: 400 });
  }
  if (!body.applicant || !body.expenseId) {
    return Response.json({ error: "applicant と expenseId が必要です" }, { status: 400 });
  }
  const row = await createRequest(body.applicant, body.expenseId);
  await auditActions.record(body.applicant, "expense.request.create", `request:${row.id}`, { after: { expenseId: body.expenseId } });
  return Response.json(row, { status: 201 });
}

export const POST = withApiObservability("/api/expenses/requests", handlePOST);
