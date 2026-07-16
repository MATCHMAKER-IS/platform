/**
 * チャット添付アップロード API（POST・multipart/form-data）。検証して storage に保存し、
 * 保存済みメタ（key/name/size/type）を返す。呼び出し側はこれを messages API の attachments に渡す。
 */
import { withApiObservability } from "../../../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../../../server/authorize";
import { serverEnv } from "../../../../../../server/env";
import { chatStorage, thumbnailService } from "../../../../../../server/chat";
import { fileManager } from "../../../../../../server/platform-services";
import { handleUpload } from "@platform/upload";

async function handlePOST(req: Request, ctx: { params: Promise<{ roomId: string }> }): Promise<Response> {
  const { roomId } = await ctx.params;
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "chat:post");

  const res = await handleUpload(req, {
    storage: chatStorage,
    keyPrefix: `chat/${roomId}`,
    maxSizeBytes: 10_000_000,
    allowedMimeTypes: ["image/", "application/pdf"],
  });
  if (!res.ok) return Response.json({ error: res.error.message }, { status: 400 });
  // 画像添付にはサムネイルを生成して thumbnailKey を付与
  const withThumbs = await thumbnailService.ensureAll(res.value);
  // ファイル管理にも登録して一覧へ反映
  for (const f of withThumbs) {
    await fileManager.register({ key: f.key, name: f.name, size: f.size, type: f.type, uploadedBy: user!.email });
  }
  return Response.json({ attachments: withThumbs }, { status: 201 });
}

export const POST = withApiObservability("/api/chat/rooms/[roomId]/attachments", handlePOST);
