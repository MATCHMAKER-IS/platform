# @platform/upload

アップロード/ダウンロードの HTTP 境界処理。multipart 受け取り→検証→保存、ダウンロード応答。

```ts
// アップロード(Route)
import { handleUpload } from "@platform/upload";
const res = await handleUpload(req, { storage, maxSizeBytes: 5_000_000, allowedMimeTypes: ["image/"] });
if (res.ok) return Response.json({ files: res.value });

// ダウンロード(Route)
import { downloadFromStorage } from "@platform/upload";
const dl = await downloadFromStorage(storage, key, { filename: "請求書.pdf", contentType: "application/pdf" });
if (dl.ok) return dl.value;
```

大きなファイルはサーバを経由させず、`storage.presignUpload(key)` / `presignDownload(key)`(S3)で
クライアント直アップロード/ダウンロードにするのが効率的です。
