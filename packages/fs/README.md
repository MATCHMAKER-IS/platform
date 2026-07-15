# @platform/fs

ファイル/フォルダ操作とパスユーティリティ。ファイル種別判定(マジックバイト)や
安全なファイル名生成など、アップロード処理で必要になる部品を提供します。

```ts
import { detectFileType, isAllowedFileType, sanitizeFilename, guessMimeType } from "@platform/fs";

detectFileType(bytes);                 // 実体(マジックバイト)から種別判定
isAllowedFileType(bytes, ["png","pdf"]); // 拡張子偽装を防ぐ実体ベース検証
sanitizeFilename("../../etc/passwd");  // 危険な文字を除去した安全な名前
```

拡張子ではなく**実体**でファイル種別を判定するため、偽装アップロード対策になります。
パス操作(`joinPath`/`isSubPath` 等)はディレクトリトラバーサル防止に。
