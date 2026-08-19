/** 経費申請への操作 API(POST)。承認/却下/差戻しをトランザクションで適用する。 */
import { withApiObservability } from "../../../../../server/instrument";
import { applyAction } from "../../../../../server/approval-repo";
import { currentUserFromValue, userCan, AuthzError } from "../../../../../server/authorize";
import { errorResponse } from "../../../../../server/api-error";
import { auditActions } from "../../../../../server/platform-services";
import { AppError, ErrorCode } from "@platform/core";
import type { Actor } from "@platform/workflow";
import { cookies } from "next/headers";
import { serverEnv } from "../../../../../server/env";
import { withIdempotency } from "@platform/http";
import { idempotencyStore } from "../../../../../server/idempotency";

const ACTIONS = ["approve", "reject", "sendback"] as const;
type Action = (typeof ACTIONS)[number];

async function handlePOST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  let body: { actor?: Actor; action?: string; reason?: string };
  try {
    body = (await req.json().catch(() => ({}))) as { actor?: Actor; action?: string; reason?: string };
  } catch {
    return errorResponse(new AppError(ErrorCode.VALIDATION, "JSON の解析に失敗しました"));
  }
  if (!body.actor || !ACTIONS.includes(body.action as Action)) {
    return errorResponse(new AppError(ErrorCode.VALIDATION, "actor と action(approve/reject/sendback)が必要です"));
  }
  // 認可: ログイン必須 + 経費承認権限(申請者本人かどうかで own/any を判定)
  let actorId = "";
  try {
    const store = await cookies();
    const user = currentUserFromValue(store.get("session")?.value, serverEnv.SESSION_SECRET);
    if (!user) throw new AuthzError(401, "ログインが必要です");
    actorId = user.email;
    // 承認には expense:approve:own か :any のいずれかが必要(employee は不可)
    if (!userCan(user, "expense:approve:own") && !userCan(user, "expense:approve:any")) {
      throw new AuthzError(403, "経費を承認する権限がありません");
    }
  } catch (e) {
    if (e instanceof AuthzError) {
      const code = e.status === 401 ? ErrorCode.UNAUTHORIZED : ErrorCode.FORBIDDEN;
      return errorResponse(new AppError(code, e.message));
    }
    throw e;
  }
  // **二重送信を防ぐ。** 承認・却下は連打で二重に走ると、
  // **監査ログに 2 回分が残る**——経緯を追えなくなる。
  //
  // **認可はここまでで済ませてある。** 冪等の内側に置くと、2 回目は
  // 保存された応答が返り、**権限チェックを経ずに結果が渡る**。
  //
  // **本文も読み終えている。** `req.json()` は 1 回しか読めないので、
  // 内側で読み直すと 2 回目は空になる。
  return withIdempotency(req, { store: idempotencyStore, scope: actorId }, () => run(id, body, actorId));
}

/** 本体(冪等キーの内側で 1 回だけ動く)。 */
async function run(
  id: string,
  body: { actor?: Actor; action?: string; reason?: string },
  actorId: string,
): Promise<Response> {
  const result = await applyAction(id, body.actor!, body.action as Action, body.reason);
  if (!result.ok) {
    // エラーの分類(CONFLICT/NOT_FOUND 等)に応じた正しいステータス + traceId 付きエンベロープ
    return errorResponse(result.error);
  }
  await auditActions.expenseDecision(actorId, id, body.action as Action, body.reason);
  return Response.json(result.value);
}

export const POST = withApiObservability("/api/expenses/requests/[id]", handlePOST);
