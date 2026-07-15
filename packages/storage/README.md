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
