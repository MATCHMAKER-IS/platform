/**
 * 汎用ファイルアップロード API（POST・multipart）。
 * @platform/storage に保存し、fileManager に登録して一覧に反映、監査ログにも記録する。
 */
import { handleUpload } from "@platform/upload";
import { withApiObservability } from "../../../../server/instrument.js";
import { currentUser, requirePermission } from "../../../../server/authorize.js";
import { serverEnv } from "../../../../server/env.js";
import { fileStorage, fileManager, auditActions } from "../../../../server/platform-services.js";

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "chat:post");

  const res = await handleUpload(req, { storage: fileStorage, keyPrefix: "files", maxSizeBytes: 20_000_000 });
  if (!res.ok) return Response.json({ error: res.error.message }, { status: 400 });

  const registered = [];
  for (const f of res.value) {
    const meta = await fileManager.register({ key: f.key, name: f.name, size: f.size, type: f.type, uploadedBy: user!.email });
    await auditActions.fileUpload(user!.email, f.key, { name: f.name, size: f.size, type: f.type });
    registered.push(meta);
  }
  return Response.json({ files: registered }, { status: 201 });
}

export const POST = withApiObservability("/api/files/upload", handlePOST);
