/** 経費申請の作成 API(POST)。 */
import { currentUser, requirePermission } from "../../../../server/authorize";
// **二重送信を防ぐ。** 経費申請は連打・再送で二重に登録されると、
// **同じ申請が 2 件並ぶ**——承認者はどちらを処理すべきか分からない。
import { withIdempotency } from "@platform/http";
import { idempotencyStore } from "../../../../server/idempotency";
import "../../../../server/env";
import { withApiObservability } from "../../../../server/instrument";
import { createRequest } from "../../../../server/approval-repo";
import { auditActions } from "../../../../server/platform-services";

async function handlePOST(req: Request): Promise<Response> {
  // 認可: この API を叩いてよいかを最初に判定する
  const user = currentUser(req);
  requirePermission(user, "expense:create");
  // **キーが無ければ素通し。** 付けるのは呼び出し側の責任。
  return withIdempotency(req, { store: idempotencyStore, scope: user!.email }, () => run(req, user!.email));
}

/** 本体(冪等キーの内側で 1 回だけ動く)。 */
async function run(req: Request, actor: string): Promise<Response> {
  let body: { applicant?: string; expenseId?: string };
  try {
    body = (await req.json().catch(() => ({}))) as { applicant?: string; expenseId?: string };
  } catch {
    return new Response("JSON の解析に失敗しました", { status: 400 });
  }
  if (!body.applicant || !body.expenseId) {
    return Response.json({ error: "applicant と expenseId が必要です" }, { status: 400 });
  }
  const row = await createRequest(body.applicant, body.expenseId);
  // **監査の「誰が」はログイン中の人(`actor`)にする。**
  // 2026-08 まで本文の `applicant` を記録しており、**要求本文を変えれば
  // 他人の名前で記録を残せる**状態だった(`actor` は受け取っていたが使われておらず、
  // `noUnusedParameters` の指摘で気づいた)。申請者は `after` に残す。
  await auditActions.record(actor, "expense.request.create", `request:${row.id}`, {
    after: { expenseId: body.expenseId, applicant: body.applicant },
  });
  return Response.json(row, { status: 201 });
}

export const POST = withApiObservability("/api/expenses/requests", handlePOST);
