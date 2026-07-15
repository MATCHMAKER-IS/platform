# @platform/workflow

多段承認ワークフローの状態機械(外部依存なしの純ロジック)。状態の永続化はアプリ側。

```ts
import { startWorkflow, approve, reject } from "@platform/workflow";
const def = { steps: [
  { name: "課長承認", approverRole: "manager" },
  { name: "部長承認", approverRole: "director" },
]};
let state = startWorkflow(def);              // pending(課長承認待ち)
const r = approve(def, state, { id: "u1", roles: ["manager"] });
if (r.ok) state = r.value;                    // pending(部長承認待ち)
```

ロールは `@platform/auth` のロールと対応させて使います。承認・却下の権限は
ステップの `approverRole` で判定します。

## 条件別ルート・並列承認・代理承認(稟議の実務パターン)
既存の線形エンジン(startWorkflow/approve/reject/sendBack)に、以下を追加できます。

### 金額別・条件別ルート
```ts
import { routeByAmount, resolveRoute } from "@platform/workflow";
const def = routeByAmount(amount, [
  { under: 100_000, steps: [{ name: "課長承認", approverRole: "manager" }] },
  { under: 1_000_000, steps: [manager, director] },
  { steps: [manager, director, executive] },  // 上限なし
]);
const state = startWorkflow(def);
```

### 代理承認(委任)
承認者不在時に、委任された人が代理で承認できます。監査用に委任元(onBehalfOf)も取れます。
```ts
import { resolveApprovalAuthority } from "@platform/workflow";
const auth = resolveApprovalAuthority(step, actor, delegations, { now });
if (auth.canApprove) approveOnBehalf(actor, auth.onBehalfOf);
```

### 並列承認(合議)
同一ステップで複数ロールの承認(全員 all / いずれか any)。
```ts
import { startParallel, recordParallelApproval, isParallelComplete } from "@platform/workflow";
let s = recordParallelApproval(step, startParallel(), actor);
if (isParallelComplete(step, s)) proceedToNextStep();
```
すべて純ロジック(副作用なし)でテスト済みです。

### 催促・エスカレーション(SLA)
承認が滞留したら催促通知、一定時間でエスカレーション。cron から回して滞留申請を洗い出せます。
```ts
import { findStalledApprovals, evaluateSla, escalationTarget } from "@platform/workflow";

const policy = { remindAfterMin: 24 * 60, reminderIntervalMin: 24 * 60, escalateAfterMin: 72 * 60 };
// 定期実行: 滞留中の申請を抽出して通知
for (const item of findStalledApprovals(pendingItems, new Date(), policy)) {
  if (item.action === "remind") notifyApprover(item.id);
  else if (item.action === "escalate") notify(escalationTarget(def, state)); // 上位者へ
}
```
`evaluateSla` は重複送信を抑止(`remindersSent` を渡す)。すべて純ロジックでテスト済み。

