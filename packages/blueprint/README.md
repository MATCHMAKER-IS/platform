# @platform/blueprint — 業務プロセスのブループリント

Zoho CRM のブループリントに相当。業務プロセスを状態と遷移で宣言的に定義し、遷移ごとの
**条件・必須項目・アクション・ロール**を強制して、正しい手順でしか進めないようにします。
素の状態遷移は `@platform/fsm` に委譲し、その上にガードを重ねています。

## 主な API
- `Blueprint`（states / transitions）、`BlueprintTransition`（from/to/name/requiredFields/condition/actions/allowedRoles）。
- `availableTransitions(bp, state, record)` — 今実行できる遷移（条件を満たすもの）。
- `evaluateTransition(bp, state, name, record, roles?)` — 状態・条件・必須項目・ロールを検証 → `{ ok, errors, nextState, actions }`。
- `applyTransition(bp, record, name, { stateField, roles })` — 検証を通れば状態を更新して返す。
- `missingRequiredFields` / `isFinalState` / `transitionNames`。

```ts
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
