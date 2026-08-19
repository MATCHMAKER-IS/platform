# @platform/accounting

会計の仕訳・試算表・電子帳簿保存法への対応。**貸借の一致を作った時点で確かめます**。

## これは何のためか

**帳簿は「1 円合わない」だけで締められません。**
どこで崩れたかを探すのに、**半日かかることもあります**。

このパッケージは、**仕訳を作った時点で貸借の一致を確かめます**——
**崩れる前に止めれば、原因は直前の 1 か所**に絞れます。

## 使う前に知っておくこと

| | |
|---|---|
| **貸借が合わないと例外** | `Result` ではなく**例外**にしてあります——`ok` を見ずに保存する経路があると、**帳簿が「たぶん合っている」**状態になるため |
| **電子帳簿保存法は 7 年** | **本人から消してと言われても消せません**（ADR 0018）。保持期間を短くすると**法令違反**です |
| **丸めは 1 か所で** | 内訳を丸めてから足すか、足してから丸めるかで**1 円ずれます** |
| **締めた期は書き換えない** | `PeriodLock` で止めています。**過去を直すなら、当期に振替**を入れてください |

## よく使うもの

```ts
import { salesJournal, trialBalance, isBalanced } from "@platform/accounting";
import { salesJournal, trialBalance, toFreeeDetails } from "@platform/accounting";
const entry = salesJournal({ date: "2025-07-01", net: 100000, tax: 10000 }); // 貸借一致した仕訳
toFreeeDetails(entry); // freee 振替伝票の details へ
```
請求(@platform/invoice）の税率別集計と組み合わせれば、売上計上の仕訳が自動生成できます。
