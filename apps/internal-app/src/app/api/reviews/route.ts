/** 口コミ: 一覧+集計(GET ?subjectType=&subjectId=)・投稿(POST)。認証ユーザー。 */
import { withApiObservability } from "../../../server/instrument.js";
import { currentUser } from "../../../server/authorize.js";
import { serverEnv } from "../../../server/env.js";
import { reviewStore, auditActions } from "../../../server/platform-services.js";
import { summarizeReviews } from "../../../server/review-repo.js";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });
  const q = new URL(req.url).searchParams;
  const subjectType = q.get("subjectType") ?? "";
  const subjectId = q.get("subjectId") ?? "";
  if (!subjectType || !subjectId) return Response.json({ error: "subjectType と subjectId が必要です" }, { status: 400 });
  const reviews = await reviewStore.list(subjectType, subjectId);
  return Response.json({ reviews, summary: summarizeReviews(subjectType, subjectId, reviews) });
}

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });
  const body = (await req.json()) as { subjectType?: string; subjectId?: string; rating?: number; title?: string; comment?: string };
  if (!body.subjectType || !body.subjectId || typeof body.rating !== "number") return Response.json({ error: "対象と評価が必要です" }, { status: 400 });
  const review = await reviewStore.add({ subjectType: body.subjectType, subjectId: body.subjectId, author: user.email, rating: body.rating, title: body.title, comment: body.comment });
  await auditActions.record(user.email, "review.add", `${body.subjectType}:${body.subjectId}`, { after: { rating: review.rating } });
  return Response.json(review, { status: 201 });
}

export const GET = withApiObservability("/api/reviews", handleGET);
export const POST = withApiObservability("/api/reviews", handlePOST);
