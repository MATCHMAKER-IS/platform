# @platform/fs

ファイルの操作（種別の判定・安全なパス）。

## これは何のためか

**利用者が送ってきたファイルは、名前を信じられません。**

`.jpg` という名前の実行ファイル——**拡張子は誰でも変えられます**。

## 使う前に知っておくこと

| | |
|---|---|
| **拡張子ではなく中身で判定** | `sniffMimeType` は**先頭のバイト**を見ます——**16 バイトあれば足ります** |
| **不明なら `null`** | 判定できないものを**推測しません**——**「たぶん画像」で処理すると危ない**ためです |
| **パスに `../` を通さない** | 利用者が付けた名前をそのまま使うと、**別の場所のファイルを読まれます** |
| **一時ファイルは必ず消す** | 消し忘れると**ディスクが埋まります**——`finally` で消してください |

## よく使うもの

```ts
import { detectFileType, isAllowedFileType, extensionMatchesContent } from "@platform/fs";
import { detectFileType, isAllowedFileType, sanitizeFilename, guessMimeType } from "@platform/fs";

detectFileType(bytes);                 // 実体(マジックバイト)から種別判定
isAllowedFileType(bytes, ["png","pdf"]); // 拡張子偽装を防ぐ実体ベース検証
sanitizeFilename("../../etc/passwd");  // 危険な文字を除去した安全な名前
```

拡張子ではなく**実体**でファイル種別を判定するため、偽装アップロード対策になります。
パス操作(`joinPath`/`isSubPath` 等)はディレクトリトラバーサル防止に。

## ブラウザからも使える種別判定(`@platform/fs/magic`)

バレル(`@platform/fs`)は `node:fs` を引き込むため、`"use client"` から import すると
**Turbopack が解決できずビルドが落ちます**。マジックバイトによる判定は Node の API に
触れないので、こちらから読めます(アップロード前にブラウザ側で弾く用途)。

```ts
"use client";
import { detectFileType, isAllowedFileType } from "@platform/fs/magic";

if (!isAllowedFileType(bytes, ["png", "jpg", "pdf"])) {
  // 拡張子ではなく**実体**で判定しているので、偽装アップロードを弾ける
}
```
