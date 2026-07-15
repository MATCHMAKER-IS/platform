# @platform/sequence

帳票番号などの連番採番(依存ゼロ)。請求書・伝票番号を、プレフィックス・ゼロ埋め・
年度/月次リセット付きで発番します。原子的インクリメントは注入ストアに委譲(本番は DB/Redis)。

```ts
import { createSequencer, createMemorySequenceStore } from "@platform/sequence";

const invoiceNo = createSequencer(store, "invoice", {
  prefix: "INV-", padding: 6, resetPeriod: "fiscalYearly", // 年度(4月始まり)でリセット
});

await invoiceNo.next(); // "INV-FY2025-000001"
await invoiceNo.next(); // "INV-FY2025-000002"
```

`resetPeriod` は never/yearly/fiscalYearly/monthly。重複しない発番はストアの原子性で担保します
(本番は DB の行ロックや Redis INCR を注入)。
