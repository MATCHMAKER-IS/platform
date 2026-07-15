# @platform/saga

saga(補償トランザクション)。複数ステップの処理を順に実行し、途中で失敗したら**完了済みステップを逆順で打ち消し**ます。外部API連携など「全体をDBトランザクションで囲えない」処理の一貫性を保つための基盤です。

- `sagaStep(name, run, compensate?)` … ステップ定義(補償は任意)
- `runSaga(steps, ctx)` … 実行。`{ ok, completed, compensated, failedStep?, error?, compensationErrors? }` を返す

```ts
import { runSaga, sagaStep } from "@platform/saga";
const result = await runSaga([
  sagaStep("在庫引当", (c) => reserve(c), (c) => release(c)),
  sagaStep("決済", (c) => charge(c), (c) => refund(c)),
  sagaStep("メール送信", (c) => notify(c)),  // 補償不要な最終ステップ
], ctx);
if (!result.ok) console.warn(`失敗: ${result.failedStep}、補償済: ${result.compensated.join(",")}`);
```

補償自体が失敗した場合は `compensationErrors` に記録され、処理は継続します(取りこぼしの検知用)。
