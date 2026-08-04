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
import { createRateLimiter, createMemoryStore } from "@platform/ratelimit/browser";

/** 受け付ける上限。**大きすぎるとサーバのディスクと時間を食う**。 */
const MAX_BYTES = 20_000_000;

/**
 * **回数を制限する。** ffprobe は外部プロセスを起動する。連打されると**CPU を占有される**。
 * メモリ実装なのでサーバごとに数える(複数台なら Redis 実装に差し替える)。
 */
const limiter = createRateLimiter({ store: createMemoryStore(), limit: 10, windowSeconds: 60 });

/** 呼び出し元を見分ける。プロキシ経由なら `x-forwarded-for` の先頭。 */
function clientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd ? (fwd.split(",")[0] ?? "unknown").trim() : "unknown";
}

export async function POST(req: Request): Promise<Response> {
  // **本文を読む前に判定する。** 読んでから弾くと、その分の資源は使われている
  const rl = await limiter.check(`media:${clientKey(req)}`);
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

  // **ffprobe はパスを取る**ので、いったんディスクに置く。
  // 拡張子は残す(コンテナ形式の判定に使われることがある)
  const dir = path.join(tmpdir(), "showcase-media");
  await mkdir(dir, { recursive: true });
  const ext = path.extname(file.name) || ".bin";
  const tmp = path.join(dir, `${randomBytes(8).toString("hex")}${ext}`);

  try {
    await writeFile(tmp, Buffer.from(await file.arrayBuffer()));
    const res = await createMediaProcessor().probe(tmp);
    if (!res.ok) {
      return Response.json({ error: `解析できませんでした: ${res.error.message}` }, { status: 400 });
    }
    return Response.json({ info: res.value, name: file.name, sizeBytes: file.size });
  } finally {
    // **必ず消す。** 残すとサーバのディスクが埋まる
    await unlink(tmp).catch(() => {});
  }
}
