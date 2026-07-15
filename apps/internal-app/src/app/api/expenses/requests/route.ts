/** 経費申請の作成 API(POST)。 */
import { withApiObservability } from "../../../../server/instrument.js";
import { createRequest } from "../../../../server/approval-repo.js";
import { auditActions } from "../../../../server/platform-services.js";

async function handlePOST(req: Request): Promise<Response> {
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
