# @platform/audit — 監査ログ（操作履歴）

「誰が・いつ・何を・どう変えたか」を追記専用で記録し、**ハッシュチェーンで改ざんを検知**します。
ブループリント遷移・承認・仕訳などの業務イベントの証跡に使えます。

## 主な API
- `appendEvent(log, event, hashFn?)` / `appendAll` — イベントを追記（seq・prevHash・hash を連鎖）。
- `verifyChain(log, hashFn?)` — **値の書換え・削除・並べ替えを検知**（`brokenAt` で位置）。
- `diffChanges(before, after)` / `describeEvent` — 変更差分と可読化。
- `filterByActor` / `filterByAction`（前方一致）/ `filterByPeriod` / `historyOf`。
- ハッシュ関数は注入可能（既定は依存なしの `fnv1a`。運用では sha256 を渡す）。

```ts
import { appendEvent, verifyChain, historyOf } from "@platform/audit";
let log = [];
log = appendEvent(log, { at: new Date().toISOString(), actor: "u1", action: "expense.approve", target: "expense:123", before: { status: "submitted" }, after: { status: "approved" } });
verifyChain(log).valid;      // true（改ざんされていれば false + brokenAt）
historyOf(log, "expense:123"); // その対象の時系列
```

## diffChanges の使い分け（@platform/db と同名）

`diffChanges` は audit と db の両方にありますが、**戻り値の形が違います**。用途で選んでください。

| | 戻り値 | 用途 |
|---|---|---|
| `@platform/audit` の diffChanges | `FieldChange[]`（配列） | 監査イベントに埋め込む。`describeEvent` と組み合わせる |
| `@platform/db` の diffChanges | `Record<string, FieldChange>`（マップ） | DB 行の before/after 差分。キー参照が多い場合 |

どちらも `{ ignore, redact }` オプションに対応しています（除外フィールド・マスク）。監査ログを残すなら audit 版、DB の行差分をフィールド名で引きたいなら db 版が向いています。
