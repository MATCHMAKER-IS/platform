/** CMS ダッシュボード集計(GET)。記事の状態別件数・ページ/お知らせ/カテゴリ数・最近の更新。 */
import { summarizePosts, recentPosts } from "@platform/cms";
import { withApiObservability } from "../../../../server/instrument.js";
import { currentUser, requirePermission } from "../../../../server/authorize.js";
import { serverEnv } from "../../../../server/env.js";
import { cmsStore, pageStore, announcementStore, categoryStore } from "../../../../server/platform-services.js";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "cms:read");
  const now = new Date();
  const [posts, pages, announcements, categories] = await Promise.all([
    cmsStore.list(),
    pageStore.list(),
    announcementStore.list(),
    categoryStore.list(),
  ]);
  return Response.json({
    posts: summarizePosts(posts, now),
    pageCount: pages.length,
    publishedPageCount: pages.filter((p) => p.status === "published").length,
    announcementCount: announcements.length,
    categoryCount: categories.length,
    recent: recentPosts(posts, 5, now),
  });
}

export const GET = withApiObservability("/api/cms/dashboard", handleGET);
