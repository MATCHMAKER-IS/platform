# @platform/contract

契約の管理（更新期限・解約通知）。**期限を過ぎると自動更新されます**。

## これは何のためか

**解約通知の期限を過ぎると、望まない 1 年が自動更新されます。**

「使っていないサービスに払い続けていた」——
**気づくのはたいてい請求書を見たとき**です。

## 使う前に知っておくこと

| | |
|---|---|
| **見るのは 2 つの期限** | **更新期限**と**解約通知期限**は別です。後者の方が先に来ます |
| **`new Date()` をそのまま使わない** | 時刻を含むと**判定が 1 日ずれます**——**JST の日付**に直してください |
| **件数ではなく「一番近い期限」を見る** | 100 件あっても、**急ぐのは数件**です |
| **通知は余裕をもって** | 解約通知が「3 か月前まで」なら、**4 か月前に知らせて**ください——検討する時間が要ります |

## よく使うもの

```ts
import { isInEffect, daysUntilEnd, noticeDeadline } from "@platform/contract";
契約終了 2026-12-31、解約予告 90 日前
  → 2026-10-02 までに申し出ないと、自動で 1 年延びる
```

この日を過ぎたことに気づかず、不要な契約が更新され続ける——これを防ぐのが `contractAlerts` です。

## 主な API

| 関数 | 用途 |
|---|---|
| `isInEffect(contract)` | 有効期間内か（**状態ではなく日付**で判定） |
| `daysUntilEnd(contract)` | 終了までの日数（過ぎていれば負） |
| `noticeDeadline(contract)` | **解約を申し出る期限**（この日までに言わないと更新される） |
| `canGiveNotice(contract)` | まだ間に合うか |
| **`contractAlerts(contracts)`** | **対応が必要な契約**を深刻な順に |
| `renew(contract)` | 更新後の姿（翌日から n ヶ月） |
| `summarizeContracts(contracts)` | ダッシュボード用の集計 |

## contractAlerts が挙げるもの

| 状況 | 深刻度 | なぜ |
|---|---|---|
| 自動更新の予告期限が 30 日以内 | **danger** | 過ぎると意図せず 1 年延びる。**最優先** |
| 予告期限を過ぎた | info | もう手遅れ。次回に備える案内 |
| 手動更新で終了まで 7 日以内 | **danger** | 放置すると切れる |
| 手動更新で終了まで 30 日以内 | warning | そろそろ手続きを |
| 終了日を過ぎて `active` のまま | warning | データの不整合。状態を直す |

## 設計の判断

| 判断 | 理由 |
|---|---|
| **有効期間は日付で判定** | `status` が `active` のまま終了日を過ぎていることがある（人が更新し忘れる） |
| **予告期限を過ぎたら danger ではなく info** | もう手遅れなので焦らせても意味がない。「次回に備える」情報として出す |
| **予告期間が無ければ `canGiveNotice` は常に true** | 「いつでも解約できる」契約もある |
| `renew` は**新しい契約を返す** | 元を書き換えない（履歴を残せるようにする） |

## 使い方

```ts
import { contractAlerts, summarizeContracts } from "@platform/contract";

// ダッシュボード: 今やるべきこと
for (const alert of contractAlerts(contracts)) {
  console.log(`[${alert.level}] ${alert.contract.title}`);
  console.log(`  ${alert.message}`);
  console.log(`  → ${alert.action}`);
}
```

DB も UI も知りません。アプリ側でストアと画面を用意して使ってください。
