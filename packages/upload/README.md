# @platform/upload

ファイルのアップロード（検査・保管・ダウンロード）。

## これは何のためか

**利用者は何でも送ってきます。**
拡張子を偽ったファイル、数十 MB の写真、実行ファイル——
**そのまま受けると、保管先が溢れるか、誰かが実行します**。

## 使う前に知っておくこと

| | |
|---|---|
| **保存する key はランダム** | 元のファイル名を使うと、**推測して他人のファイルを取られます** |
| **種別が違っても保存します** | `typeMatches` が `false` でも**保存はされます**——**拒むと正しいファイルまで通らなくなる**ためです。**記録して人が見る**形にしてください |
| **EXIF は残ります** | `hasExif` が `true` でも保存されます——**領収書を撮ると、どこで撮ったかが残ります**。消すなら `@platform/image` へ |
| **ダウンロードは `attachment`** | `Content-Disposition` と `nosniff` で、**ブラウザに開かせません** |
| **既定は 25MB** | スマホの写真は**そのままだと超えます**——送る前に縮めてください |

## よく使うもの

```ts
import { handleUpload, serveDownload, downloadFromStorage } from "@platform/upload";
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
