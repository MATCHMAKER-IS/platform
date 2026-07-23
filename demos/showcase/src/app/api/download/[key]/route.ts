// public-api: デモ用。推測しにくい鍵を知っている人だけが取得できる
/** ダウンロード API。storage のキーからファイルを配信。 */
import { downloadFromStorage } from "@platform/upload";
import { createStorage, createLocalStorage } from "@platform/storage";

const storage = createStorage(createLocalStorage("/tmp/showcase-uploads"));

export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const dl = await downloadFromStorage(storage, `uploads/${key}`, { filename: key, inline: true });
  if (!dl.ok) return Response.json({ error: { message: dl.error.message } }, { status: 404 });
  return dl.value;
}
