# @platform/fsm

状態遷移（申請 → 承認 → 完了のような流れ）。

## これは何のためか

**「その状態からは行けないはず」を型で縛る**ためのものです。

却下された申請が、いきなり「完了」になる——
**手で書くと必ずどこかで抜けます**。

## 使う前に知っておくこと

| | |
|---|---|
| **型では防げないものがあります** | **到達できない状態**（どこからも行けない）、**出られない状態**（行き止まり）——**設計の誤り**です。`validateMachine` で見つけてください |
| **行き止まりが正しいこともあります** | 「完了」「破棄」は出られなくて構いません——**意図しているかどうか**が問題です |
| **状態を増やしすぎない** | 5 つを超えると、**誰も全体を把握できません** |
| **状態と権限は別** | 「承認できる状態か」と「この人が承認してよいか」は**分けて**ください |

## よく使うもの

```ts
import { validateMachine, can, transition } from "@platform/fsm";
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
