# @platform/task

タスク管理の純ロジック（担当・期限・状態遷移・進捗）。

**プロジェクト管理もこれで賄えます。** タスクに `projectId` を持たせるだけです。「プロジェクト」は「タスクの束」に過ぎず、別の仕組みを作る必要はありません。

## 状態遷移

**順序を飛ばせません。** 着手せずに完了、はおかしいからです。

```
todo ──→ doing ──→ review ──→ done
  ↑        ↑ ↓         ↓         │
  └────────┴─┴─────────┘         │  差し戻し
  ↑                                │
  └────────────────────────────────┘

どの状態からでも canceled にできる（やらないと決めた）
canceled → todo で復活もできる
```

```ts
transition(task, "doing");   // todo → doing: OK
transition(task, "done");    // todo → done: VALIDATION エラー
```

## 主な API

| 関数 | 用途 |
|---|---|
| `canTransition(from, to)` / `transition(task, to)` | 状態遷移（不正なら例外） |
| `isOverdue(task)` / `daysUntilDue(task)` | 期限（done / canceled は対象外） |
| `summarize(tasks)` | 進捗・期限切れ・工数の集計 |
| `sortTasks(tasks, by?)` | 優先度 / 期限 / 状態で並べ替え |
| `filterTasks(tasks, filter)` | 状態・担当・プロジェクト・期限切れ・親のみ |
| `toKanban(tasks)` | かんばん（4 列。canceled は出さない） |
| `workloadByAssignee(tasks)` | 担当者ごとの負荷（**誰に偏っているか**） |

## 設計の判断

| 判断 | 理由 |
|---|---|
| **中止は進捗の分母から除く** | 「やらないと決めた」ものを未完扱いすると、進捗が永久に 100% にならない |
| **期限なしは並べ替えで最後** | 期限があるものを先に見せた方が使う人の役に立つ |
| **負荷は未完のみ集計** | 終わった仕事は負荷ではない |
| **かんばんに canceled を出さない** | 見たいのは「今やること」。中止したものは一覧で探せば足りる |

## 使い方

```ts
import { summarize, toKanban, transition, workloadByAssignee } from "@platform/task";

// 進捗
const progress = summarize(tasks);
console.log(`${Math.round(progress.rate * 100)}% 完了（期限切れ ${progress.overdue} 件）`);

// かんばん表示
for (const col of toKanban(tasks)) {
  console.log(col.status, col.tasks.length);
}

// 誰に偏っているか
for (const w of workloadByAssignee(tasks)) {
  console.log(`${w.assignee}: ${w.count} 件 / ${w.hours}h`);
}
```

DB も UI も知りません。アプリ側でストアと画面を用意して使ってください。
