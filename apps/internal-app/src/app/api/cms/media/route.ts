/** メディアライブラリ: アップロード済み画像の一覧(GET)。CMS の keyPrefix "cms" を対象。 */
import { withApiObservability } from "../../../../server/instrument.js";
import { currentUser, requirePermission } from "../../../../server/authorize.js";
import { serverEnv, featureEnv } from "../../../../server/env.js";
import { fileManager } from "../../../../server/platform-services.js";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "cms:read");
  const files = await fileManager.list({ prefix: "cms", limit: 100 });
  const base = featureEnv.PUBLIC_UPLOADS_URL;
  const media = files
    .filter((f) => f.type.startsWith("image/"))
    .map((f) => ({ key: f.key, url: `${base}/${f.key}`, name: f.name, size: f.size, type: f.type, uploadedAt: f.uploadedAt }));
  return Response.json({ media });
}

export const GET = withApiObservability("/api/cms/media", handleGET);
