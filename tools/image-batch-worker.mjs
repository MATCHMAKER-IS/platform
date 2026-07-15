/**
 * jobs × image の一括処理ワーカー例(Redis 不要のインメモリキューで動作確認)。
 * 実運用では createQueue(Redis) + createWorker に置き換える。
 *
 *   node tools/image-batch-worker.mjs   （要 pnpm install + sharp）
 */
import { createMemoryQueue } from "@platform/jobs";
import { createImageProcessor } from "@platform/image";
// import sharp from "sharp";  // 実行時に有効化

const queue = createMemoryQueue(); // 大量・分散なら createQueue("images", { url: REDIS_URL })
const image = createImageProcessor(/* sharp */);

// ワーカー: 受け取った画像を実用サイズへ正規化(EXIF/GPS も落ちる)
queue.process(async (data) => {
  const res = await image.normalizeUpload(data.buffer, { maxWidth: 1600, format: "webp", quality: 82 });
  if (res.ok) console.log(`processed ${data.name}: ${res.value.length} bytes`);
  else console.error(`failed ${data.name}: ${res.error.message}`);
});

// 大量の画像を投入(実際はアップロード時に enqueue)
// for (const file of files) await queue.add("normalize", { name: file.name, buffer: file.bytes });
console.log("image batch worker ready (see source).");
