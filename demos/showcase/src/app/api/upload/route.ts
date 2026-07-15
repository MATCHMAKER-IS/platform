/** アップロード API。@platform/upload で受け取り→検証→ローカル storage 保存。 */
import { handleUpload } from "@platform/upload";
import { createStorage, createLocalStorage } from "@platform/storage";

const storage = createStorage(createLocalStorage("/tmp/showcase-uploads"));

export async function POST(req: Request) {
  const res = await handleUpload(req, {
    storage,
    maxSizeBytes: 10_000_000,
    allowedMimeTypes: ["image/", "application/pdf", "text/"],
  });
  if (!res.ok) return Response.json({ error: { message: res.error.message } }, { status: 400 });
  return Response.json({ files: res.value });
}
