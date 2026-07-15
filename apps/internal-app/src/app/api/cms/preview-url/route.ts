/** プレビュー URL の発行（GET ?slug=xxx）。公開サイトの /preview へ token 付きリンクを返す。 */
import { buildPreviewUrl } from "@platform/cms";
import { withApiObservability } from "../../../../server/instrument.js";
import { currentUser, requirePermission } from "../../../../server/authorize.js";
import { serverEnv, featureEnv } from "../../../../server/env.js";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "cms:read");
  const slug = new URL(req.url).searchParams.get("slug") ?? "";
  const token = featureEnv.PREVIEW_TOKEN || undefined;
  if (!token) return Response.json({ error: "PREVIEW_TOKEN が設定されていません" }, { status: 400 });
  const baseUrl = featureEnv.PUBLIC_SITE_URL;
  return Response.json({ url: buildPreviewUrl(baseUrl, slug, token) });
}

export const GET = withApiObservability("/api/cms/preview-url", handleGET);
