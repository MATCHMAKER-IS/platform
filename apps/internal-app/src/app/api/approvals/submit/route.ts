/** 伝票承認: 発注・請求を金額別ルートで申請(POST)。docType に応じ purchase:write / invoice:write。 */
import { withApiObservability } from "../../../../server/instrument";
// **二重送信を防ぐ。** 承認申請は連打・再送で二重に登録されると、
// **同じ申請が 2 件並ぶ**——承認者はどちらを処理すべきか分からない。
import { withIdempotency } from "@platform/http";
import { idempotencyStore } from "../../../../server/idempotency";
import { currentUser, requirePermission } from "../../../../server/authorize";
import "../../../../server/env";
import { docApprovalStore, auditActions } from "../../../../server/platform-services";
import { type DocType } from "../../../../server/doc-approval-repo";

type SubmitBody = { docType: DocType; docNumber: string; amount: number };

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req);
  // **本文を先に読む。** ここの認可は `docType` で必要な権限が変わるため、
  // 本文を見ないと判定できない。
  //
  // **`req.json()` は 1 回しか読めない**ので、読んだ結果を `run` へ渡す
  // ——冪等の内側で読み直すと、2 回目の呼び出しで本文が空になる。
  const body = (await req.json().catch(() => ({}))) as SubmitBody;
  // **金額は整数で受ける。** 小数を通すと Int 列への書き込みで落ちる。
  const badAmount = !Number.isSafeInteger(body.amount) || body.amount <= 0;
  if (!["purchase", "invoice"].includes(body.docType) || !body.docNumber || badAmount) {
    return Response.json({ error: "docType(purchase/invoice)・docNumber・1 円以上の整数の金額が必要です" }, { status: 400 });
  }
  // **認可は冪等の外で行う。** 内側に置くと、2 回目は保存された応答が返り、
  // **権限チェックを経ずに結果が渡る**。
  requirePermission(user, body.docType === "invoice" ? "invoice:write" : "purchase:write");
  return withIdempotency(req, { store: idempotencyStore, scope: user!.email }, () => run(body, user!.email));
}

/** 本体(冪等キーの内側で 1 回だけ動く)。 */
async function run(body: SubmitBody, actor: string): Promise<Response> {
  const approval = await docApprovalStore.submit(body.docType, body.docNumber, body.amount, actor);
  await auditActions.record(actor, "approval.submit", `${body.docType}:${body.docNumber}`, { after: { amount: body.amount, steps: approval.totalSteps } });
  return Response.json(approval, { status: 201 });
}

export const POST = withApiObservability("/api/approvals/submit", handlePOST);
