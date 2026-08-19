# @platform/audit

監査ログ（誰が何をしたか）。**後から追えることが目的**です。

## これは何のためか

**「誰がやったか分からない」が一番困ります。**

不正を疑うためではなく、**間違いを直すため**です——
「この金額はいつ変わったのか」を追えれば、**戻せます**。

## 使う前に知っておくこと

| | |
|---|---|
| **変わっていない項目は記録しません** | 全部を残すと**差分が埋もれます**。**何が変わったか**だけを見せてください |
| **監査ログは人が読むもの** | ID の羅列ではなく、**「山田が経費 1234 の金額を 3,000 → 5,000 に変えた」**と書いてください |
| **後から足せません** | 「あのとき記録していれば」は取り返しがつきません——**迷ったら記録**してください |
| **保持期間は用途で決める** | 会計に関わるものは**7 年**（電子帳簿保存法）です |
| **消せません** | 本人から求められても、**法令で残す義務があるもの**は消せません（ADR 0018） |

## よく使うもの

```ts
import { diffChanges, describeEvent, deepDiffChanges } from "@platform/audit";
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
