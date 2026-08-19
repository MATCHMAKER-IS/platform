// public-api: デモ用。アップロードされた動画/音声のメタ情報を返す。
/**
 * メディアのメタ情報を返す API。**`@platform/media` をそのまま動かす**。
 *
 * ffprobe は**サーバの外部プロセス**なのでブラウザからは呼べない。
 * 以前のデモはブラウザの `<video>` 要素で長さと解像度を読んでいたが、
 * それでは**コーデック・ビットレート・音声トラックが分からない**うえ、
 * 基盤が壊れても気づけない。
 *
 * ffmpeg のバイナリは `ffmpeg-static` / `ffprobe-static` が同梱するので、
 * **`pnpm install` だけで動く**(サーバに ffmpeg を入れる必要はない)。
 */
import { writeFile, unlink, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { createMediaProcessor } from "@platform/media";
import { detectFileType } from "@platform/fs";
import { createRateLimiter, createMemoryStore } from "@platform/ratelimit/browser";
import { handleRoute } from "@platform/http";
// **呼び出し元の見分け方は基盤に 1 つ**（同じ 3 行が 8 ファイルに散っていた）
import { clientIp } from "@platform/guard";

/** 受け付ける上限。**大きすぎるとサーバのディスクと時間を食う**。 */
const MAX_BYTES = 20_000_000;

/**
 * **回数を制限する。** ffprobe は外部プロセスを起動する。連打されると**CPU を占有される**。
 * メモリ実装なのでサーバごとに数える(複数台なら Redis 実装に差し替える)。
 */
const limiter = createRateLimiter({ store: createMemoryStore(), limit: 10, windowSeconds: 60 });

async function handlePOST(req: Request): Promise<Response> {
  // **本文を読む前に判定する。** 読んでから弾くと、その分の資源は使われている
  const rl = await limiter.check(`media:${clientIp(req)}`);
  if (rl.ok && !rl.value.allowed) {
    return Response.json(
      { error: "呼び出しが多すぎます。しばらく待ってからやり直してください" },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "ファイルが選ばれていません" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: `${Math.floor(MAX_BYTES / 1_000_000)}MB までにしてください` }, { status: 400 });
  }

  // **中身で種別を判定してから受け取る。** 拡張子と Content-Type は
  // 送る側が自由に名乗れるので、**判定の根拠にしてはいけない**。
  // ここを飛ばすと、`.mp4` と名乗る別物をそのまま ffprobe に渡すことになる。
  const head = new Uint8Array(await file.slice(0, 64).arrayBuffer());
  const kind = detectFileType(head);
  if (kind === null) {
    return Response.json(
      { error: "対応していない形式です（中身を見て判定しています）" },
      { status: 400 },
    );
  }

  // **ffprobe はパスを取る**ので、いったんディスクに置く。
  // 拡張子は**判定した種別から付ける**(送られてきた名前は使わない)
  const dir = path.join(tmpdir(), "showcase-media");
  await mkdir(dir, { recursive: true });
  const tmp = path.join(dir, `${randomBytes(8).toString("hex")}.${kind.ext}`);

  try {
    await writeFile(tmp, Buffer.from(await file.arrayBuffer()));
    const res = await createMediaProcessor().probe(tmp);
    if (!res.ok) {
      return Response.json({ error: `解析できませんでした: ${res.error.message}` }, { status: 400 });
    }
    return Response.json({ info: res.value, name: file.name, sizeBytes: file.size, detected: kind });
  } finally {
    // **必ず消す。** 残すとサーバのディスクが埋まる
    await unlink(tmp).catch(() => {});
  }
}

export const POST = handleRoute(handlePOST);
