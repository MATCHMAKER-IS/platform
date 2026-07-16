/**
 * CMS 用の画像アップロード（POST・multipart）。@platform/upload + storage を再利用。
 * 返り値の url は公開配信パス（本番は CDN / 静的配信の URL を組み立てる）。
 */
import { handleUpload } from "@platform/upload";
import { withApiObservability } from "../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../server/authorize";
import { serverEnv, featureEnv } from "../../../../server/env";
import { fileStorage, fileManager, auditActions } from "../../../../server/platform-services";

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "cms:edit");
  const res = await handleUpload(req, { storage: fileStorage, keyPrefix: "cms", maxSizeBytes: 10_000_000, allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"] });
  if (!res.ok) return Response.json({ error: res.error.message }, { status: 400 });
  const uploaded = [];
  const base = featureEnv.PUBLIC_UPLOADS_URL;
  for (const f of res.value) {
    await fileManager.register({ key: f.key, name: f.name, size: f.size, type: f.type, uploadedBy: user!.email });
    await auditActions.fileUpload(user!.email, f.key, { name: f.name, size: f.size, type: f.type });
    uploaded.push({ key: f.key, url: `${base}/${f.key}`, name: f.name });
  }
  return Response.json({ files: uploaded }, { status: 201 });
}

export const POST = withApiObservability("/api/cms/upload", handlePOST);
