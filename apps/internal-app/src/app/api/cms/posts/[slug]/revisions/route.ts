/** 記事のリビジョン一覧(GET)。 */
import { withApiObservability } from "../../../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../../../server/authorize";
import "../../../../../../server/env";
import { revisionStore } from "../../../../../../server/platform-services";

async function handleGET(req: Request, ctx: { params: Promise<{ slug: string }> }): Promise<Response> {
  const { slug } = await ctx.params;
  const user = currentUser(req);
  requirePermission(user, "cms:read");
  return Response.json({ revisions: await revisionStore.list(slug) });
}

export const GET = withApiObservability("/api/cms/posts/[slug]/revisions", handleGET);
