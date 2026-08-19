// public-api: デモ用。保存先はメモリで、再起動すると消える
/** アップロード API。@platform/upload で受け取り→検証→ローカル storage 保存。 */
import { handleUpload } from "@platform/upload";
import { createStorage, createLocalStorage } from "@platform/storage";
import { createRateLimiter, createMemoryStore } from "@platform/ratelimit/browser";
import { handleRoute } from "@platform/http";
// **呼び出し元の見分け方は基盤に 1 つ**（同じ 3 行が 8 ファイルに散っていた）
import { clientIp } from "@platform/guard";

const storage = createStorage(createLocalStorage("/tmp/showcase-uploads"));

/**
 * **回数を制限する。** アップロードはディスクを消費する。無防備だと**容量を埋め尽くされる**。
 * メモリ実装なのでサーバごとに数える(複数台なら Redis 実装に差し替える)。
 */
const limiter = createRateLimiter({ store: createMemoryStore(), limit: 20, windowSeconds: 60 });

async function handlePOST(req: Request) {
  // **本文を読む前に判定する。** 読んでから弾くと、その分の資源は使われている
  const rl = await limiter.check(`upload:${clientIp(req)}`);
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

export const POST = handleRoute(handlePOST);
