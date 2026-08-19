# @platform/storage

ファイルの保管（ローカル・S3 互換）。

## これは何のためか

**保管先を後から変えられる**ようにするためのものです。
開発中はローカル、本番は S3——**アプリのコードは変えません**。

## 使う前に知っておくこと

| | |
|---|---|
| **key に `../` は使えません** | 例外になります——**利用者が付けた名前をそのまま key にすると踏みます**。**key はこちらで作って**ください |
| **既定では上書きしません** | 同じ key に置くと失敗します——**事故で消える**のを防ぐためです |
| **消しても戻せません** | バケットの版管理は**こちらでは面倒を見ません**。消す前に確かめてください |
| **ローカル実装は 1 台まで** | 2 台構成だと**片方にしか無いファイル**ができます |

## よく使うもの

```ts
import { createLocalStorage, createS3Storage } from "@platform/storage";
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
