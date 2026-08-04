# @platform/storage

ファイル操作の共通部品(Adapter パターン)。保存先を意識せず使えます。

- `createLocalStorage(root)` … ローカルディスク(開発・小規模)
- `createS3Storage(config)` … AWS S3 / ConoHa 等の S3 互換ストレージ

```ts
import { createStorage, createLocalStorage } from "@platform/storage";
const storage = createStorage(createLocalStorage("./uploads"));
await storage.put("invoices/2026-01.pdf", bytes, { contentType: "application/pdf" });
const file = await storage.get("invoices/2026-01.pdf");
```

保存先を S3 に替えても、アプリのコードは `createStorage` に渡す Adapter を変えるだけです。

## コピー・移動・整理(`@platform/storage/operations`)

`Storage` は保存・取得・削除しか持ちません。実装(S3・ローカル・メモリ)を
増やしやすくするための意図的な設計です。実務で要る操作は、**既存の操作の組み合わせ**として
こちらに置いてあります。`StorageAdapter` を増やさないので、実装を足すときの負担が変わりません。

```ts
import { copyFile, moveFile, deleteByPrefix, calcUsage } from "@platform/storage/operations";

await moveFile(storage, "draft/2026-01.pdf", "approved/2026-01.pdf");  // 承認されたら移す
await deleteByPrefix(storage, "tmp/user-42/");                          // 退職者の一時ファイル
const usage = await calcUsage(storage, "invoices/");                    // 誰がどれだけ使っているか
```

- **原子的ではありません。** コピーは「取得 → 保存」、移動は「取得 → 保存 → 削除」です。
  途中で失敗すると、コピーは元が残り(安全側)、移動は両方に残ります(元を消す前に保存を確認するため)。
- S3 のようにサーバ側コピーができる実装ならそちらの方が速く確実です。これは
  **どの実装でも動く共通の下限**として用意しています。
- 一括操作は失敗を握りつぶさず、`BatchResult.failed` にキーと理由を返します。
