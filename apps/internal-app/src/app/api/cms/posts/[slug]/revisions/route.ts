/** 記事のリビジョン一覧(GET)。 */
import { withApiObservability } from "../../../../../../server/instrument.js";
import { currentUser, requirePermission } from "../../../../../../server/authorize.js";
import { serverEnv } from "../../../../../../server/env.js";
import { revisionStore } from "../../../../../../server/platform-services.js";

async function handleGET(req: Request, ctx: { params: Promise<{ slug: string }> }): Promise<Response> {
  const { slug } = await ctx.params;
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "cms:read");
  return Response.json({ revisions: await revisionStore.list(slug) });
}

export const GET = withApiObservability("/api/cms/posts/[slug]/revisions", handleGET);
