/** 口コミ モデレーション: 非表示化/再表示(POST)。管理者のみ。GET は非表示含む一覧。 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser } from "../../../../server/authorize";
import { serverEnv } from "../../../../server/env";
import { reviewStore, auditActions } from "../../../../server/platform-services";

function admin(req: Request) {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  return user && user.roles.includes("admin") ? user : null;
}

async function handleGET(req: Request): Promise<Response> {
  if (!admin(req)) return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  const q = new URL(req.url).searchParams;
  const subjectType = q.get("subjectType") ?? "";
  const subjectId = q.get("subjectId") ?? "";
  if (!subjectType || !subjectId) return Response.json({ error: "subjectType と subjectId が必要です" }, { status: 400 });
  return Response.json({ reviews: await reviewStore.list(subjectType, subjectId, true) });
}

async function handlePOST(req: Request): Promise<Response> {
  const user = admin(req);
  if (!user) return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  const body = (await req.json()) as { id?: string; hidden?: boolean };
  if (!body.id || typeof body.hidden !== "boolean") return Response.json({ error: "id と hidden が必要です" }, { status: 400 });
  await reviewStore.setHidden(body.id, body.hidden);
  await auditActions.record(user.email, body.hidden ? "review.hide" : "review.show", `review:${body.id}`, {});
  return Response.json({ id: body.id, hidden: body.hidden });
}

export const GET = withApiObservability("/api/reviews/moderate", handleGET);
export const POST = withApiObservability("/api/reviews/moderate", handlePOST);
