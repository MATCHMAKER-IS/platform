# @platform/fsm

汎用ステートマシン(純関数)。在庫・チケット・配送などの状態遷移を宣言的に定義します。
ジェネリクスで状態・イベントを型安全に扱えます(`@platform/workflow` より低レベルの部品)。

```ts
import { createStateMachine } from "@platform/fsm";

const order = createStateMachine({
  initial: "pending",
  transitions: {
    pending:  { pay: "paid", cancel: "cancelled" },
    paid:     { ship: "shipped" },
    shipped:  { deliver: "delivered" },
  },
  final: ["delivered", "cancelled"],
});

order.can("pending", "pay");        // true
order.transition("pending", "pay"); // { ok: true, state: "paid" }
```

不正な遷移(未定義イベント)は型と実行時の両方で弾きます。承認以外の一般的な状態機械に。
