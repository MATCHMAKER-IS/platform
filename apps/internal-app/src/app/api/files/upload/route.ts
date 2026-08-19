/**
 * 汎用ファイルアップロード API（POST・multipart）。
 * @platform/storage に保存し、fileManager に登録して一覧に反映、監査ログにも記録する。
 */
import { metrics } from "../../../../server/observability";
import { handleUpload } from "@platform/upload";
import { createImageProcessor } from "@platform/image";
import { withApiObservability } from "../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../server/authorize";
import "../../../../server/env";
import { fileStorage, fileManager, auditActions } from "../../../../server/platform-services";
import { log } from "../../../../server/services";

const imageProcessor = createImageProcessor();

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req);
  requirePermission(user, "chat:post");

  const res = await handleUpload(req, { storage: fileStorage, keyPrefix: "files", maxSizeBytes: 20_000_000 });
  if (!res.ok) return Response.json({ error: res.error.message }, { status: 400 });

  const registered = [];
  for (const f of res.value) {
    // **種別・EXIF の点検は登録の前に済ませる。** EXIF を除去すると
    // ファイルサイズが変わるため、`fileManager.register` に渡す size は
    // **除去した後の値**にする(先に登録すると、一覧の表示サイズが
    // 実際のファイルと食い違う)。
    if (f.typeMatches === false) {
      log.warn({ name: f.name, declared: f.type }, "アップロードされたファイルの種別が中身と食い違います");
      // **こちらは滅多に起きない**ので、増えたら調べる価値がある
      metrics.incrementCounter("upload.type_mismatch", 1);
    }

    let size = f.size;
    if (f.hasExif === true) {
      // **EXIF が残っている。** 領収書の写真なら**撮影場所が残る**——
      // `@platform/image` の `stripMetadata` に通して消す
      // (2026-08 まで検出して警告するだけで、実際には消していなかった)。
      const original = await fileStorage.get(f.key);
      if (original.ok) {
        const stripped = await imageProcessor.stripMetadata(original.value);
        if (stripped.ok) {
          await fileStorage.put(f.key, stripped.value);
          size = stripped.value.byteLength;
          log.info({ name: f.name }, "アップロードされた画像の EXIF(撮影情報・位置情報)を除去しました");
        } else {
          // **除去に失敗しても保存は取り消さない。** 元のファイルは残っているので
          // 業務は止まらない——ただし EXIF が残ったままなので必ず記録する。
          log.warn({ name: f.name }, "EXIF の除去に失敗しました。画像に撮影情報が残っている可能性があります");
        }
      }
      metrics.incrementCounter("upload.exif_stripped", 1);
    }

    const meta = await fileManager.register({ key: f.key, name: f.name, size, type: f.type, uploadedBy: user!.email });
    await auditActions.fileUpload(user!.email, f.key, { name: f.name, size, type: f.type });
    registered.push(meta);
  }
  return Response.json({ files: registered }, { status: 201 });
}

export const POST = withApiObservability("/api/files/upload", handlePOST);
