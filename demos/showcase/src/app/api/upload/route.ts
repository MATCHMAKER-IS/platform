// public-api: デモ用。保存先はメモリで、再起動すると消える
/** アップロード API。@platform/upload で受け取り→検証→ローカル storage 保存。 */
import { handleUpload } from "@platform/upload";
import { createStorage, createLocalStorage } from "@platform/storage";
import { createRateLimiter, createMemoryStore } from "@platform/ratelimit/browser";

const storage = createStorage(createLocalStorage("/tmp/showcase-uploads"));

/**
 * **回数を制限する。** アップロードはディスクを消費する。無防備だと**容量を埋め尽くされる**。
 * メモリ実装なのでサーバごとに数える(複数台なら Redis 実装に差し替える)。
 */
const limiter = createRateLimiter({ store: createMemoryStore(), limit: 20, windowSeconds: 60 });

/** 呼び出し元を見分ける。プロキシ経由なら `x-forwarded-for` の先頭。 */
function clientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd ? (fwd.split(",")[0] ?? "unknown").trim() : "unknown";
}

export async function POST(req: Request) {
  // **本文を読む前に判定する。** 読んでから弾くと、その分の資源は使われている
  const rl = await limiter.check(`upload:${clientKey(req)}`);
  if (rl.ok && !rl.value.allowed) {
    return Response.json(
      { error: "呼び出しが多すぎます。しばらく待ってからやり直してください" },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const res = await handleUpload(req, {
    storage,
    maxSizeBytes: 10_000_000,
    allowedMimeTypes: ["image/", "application/pdf", "text/"],
  });
  if (!res.ok) return Response.json({ error: { message: res.error.message } }, { status: 400 });
  return Response.json({ files: res.value });
}
