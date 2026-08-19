// public-api: デモ用。推測しにくい鍵を知っている人だけが取得できる
/** ダウンロード API。storage のキーからファイルを配信。 */
import { downloadFromStorage } from "@platform/upload";
import { createStorage, createLocalStorage } from "@platform/storage";
import { handleRoute } from "@platform/http";

const storage = createStorage(createLocalStorage("/tmp/showcase-uploads"));

async function handleGET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  // **`inline: true` にしない。** ここが返すのは**利用者がアップロードしたもの**で、
  // ブラウザがその場で開くと HTML や SVG のスクリプトが**このドメインで動く**
  // (保存されたクッキーも読める)。`image/png` と申告された HTML でも、
  // ブラウザは中身を見て判断することがある(2026-08 に修正)。
  const dl = await downloadFromStorage(storage, `uploads/${key}`, { filename: key });
  if (!dl.ok) return Response.json({ error: { message: dl.error.message } }, { status: 404 });
  return dl.value;
}

export const GET = handleRoute(handleGET);
