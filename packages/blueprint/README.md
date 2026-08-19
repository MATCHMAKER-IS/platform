# @platform/blueprint

業務フローの設計図（状態と遷移の定義・検証）。

## これは何のためか

**業務の流れを、動かす前に確かめる**ためのものです。

「却下されたら、どこへ戻るのか」——
**書き出してみると、決まっていないことが分かります**。

## 使う前に知っておくこと

| | |
|---|---|
| **到達できない状態を探す** | どこからも行けない状態は、**設計の抜け**です |
| **出られない状態を探す** | 行き止まりに入ると、**業務が進まなくなります**——「完了」以外は要注意です |
| **状態を増やしすぎない** | 5 つを超えると、**誰も全体を把握できません** |
| **設計図と実装は別物** | ここで確かめても、**実装が同じとは限りません**——`@platform/fsm` で**実際に縛って**ください |

## よく使うもの

```ts
import { validateBlueprint, toStateMachine, missingRequiredFields } from "@platform/blueprint";
import { evaluateTransition, applyTransition, type Blueprint } from "@platform/blueprint";

const expenseFlow: Blueprint<"draft" | "submitted" | "approved", Expense> = {
  initial: "draft", states: ["draft", "submitted", "approved"],
  transitions: [
    { from: "draft", to: "submitted", name: "提出", requiredFields: ["amount", "purpose"], actions: ["notifyApprover"] },
    { from: "submitted", to: "approved", name: "承認", condition: (r) => r.amount <= 100000, allowedRoles: ["manager"], actions: ["createJournal"] },
  ],
};
const r = applyTransition(expenseFlow, expense, "提出"); // 必須項目が埋まっていなければ ok:false
// r.actions を見て通知・仕訳起票などの副作用を実行する
```
経費・稟議・受発注など、承認や必須入力を伴うプロセスの土台に使えます。
