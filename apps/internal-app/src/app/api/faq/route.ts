/**
 * FAQ API。検索・投票・集計は `@platform/faq` の担当。ここは HTTP の入出力だけ。
 */
import { withApiObservability } from "../../../server/instrument.js";
import { currentUser } from "../../../server/authorize.js";
import { serverEnv } from "../../../server/env.js";
import { faqStore } from "../../../server/faq-repo.js";
import { searchFaq, byCategory, publishedOnly, sortByHelpfulness, summarizeFaq, needsReview, vote, helpfulRate } from "@platform/faq";
import { AppError } from "@platform/core";

function user(req: Request) {
  return currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
}

async function handleGET(req: Request): Promise<Response> {
  const u = user(req);
  if (!u) return Response.json({ error: "ログインが必要です" }, { status: 401 });
  const url = new URL(req.url);
  const all = await faqStore.list();
  const q = url.searchParams.get("q");

  // 検索
  if (q) {
    const hits = searchFaq(all, q);
    // 検索から開かれた FAQ は「見られた」ことになる(上位のみ)
    if (hits[0]) await faqStore.incrementViews(hits[0].item.id);
    return Response.json({
      hits: hits.map((h) => ({ ...h, rate: helpfulRate(h.item) })),
    });
  }

  // 管理者向けの集計(要見直しの FAQ を含む)
  if (url.searchParams.get("admin") === "1" && u.roles.includes("admin")) {
    return Response.json({
      summary: summarizeFaq(all),
      needsReview: needsReview(all).map((r) => ({ item: r.item, reason: r.reason })),
      all: sortByHelpfulness(all),
    });
  }

  // 一覧(カテゴリ別)
  return Response.json({
    categories: byCategory(all),
    popular: sortByHelpfulness(publishedOnly(all)).slice(0, 5),
  });
}

async function handlePOST(req: Request): Promise<Response> {
  const u = user(req);
  if (!u) return Response.json({ error: "ログインが必要です" }, { status: 401 });
  const body = (await req.json()) as { id?: string; helpful?: boolean };
  if (!body.id || typeof body.helpful !== "boolean") {
    return Response.json({ error: "id と helpful が必要です" }, { status: 400 });
  }
  const item = await faqStore.get(body.id);
  if (!item) return Response.json({ error: "FAQ が見つかりません" }, { status: 404 });

  try {
    const voted = vote(item, body.helpful);
    const updated = await faqStore.update(body.id, voted);
    return Response.json({ item: updated, rate: updated ? helpfulRate(updated) : undefined });
  } catch (e) {
    if (e instanceof AppError) return Response.json({ error: e.message }, { status: 400 });
    throw e;
  }
}

export const GET = withApiObservability("/api/faq", handleGET);
export const POST = withApiObservability("/api/faq", handlePOST);
