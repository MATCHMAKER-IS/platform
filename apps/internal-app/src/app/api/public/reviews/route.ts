/** 公開: 可視の口コミと集計を返す(GET ?subjectType=&subjectId=)。認証不要（公開サイト掲載用）。非表示は返さない。 */
import { withApiObservability } from "../../../../server/instrument.js";
import { reviewStore } from "../../../../server/platform-services.js";
import { summarizeReviews } from "../../../../server/review-repo.js";

async function handleGET(req: Request): Promise<Response> {
  const q = new URL(req.url).searchParams;
  const subjectType = q.get("subjectType") ?? "";
  const subjectId = q.get("subjectId") ?? "";
  if (!subjectType || !subjectId) return Response.json({ error: "subjectType と subjectId が必要です" }, { status: 400 });
  const reviews = await reviewStore.list(subjectType, subjectId); // 可視のみ
  return Response.json({ reviews: reviews.map((r) => ({ author: r.author, rating: r.rating, title: r.title, comment: r.comment, createdAt: r.createdAt })), summary: summarizeReviews(subjectType, subjectId, reviews) });
}

export const GET = withApiObservability("/api/public/reviews", handleGET);
