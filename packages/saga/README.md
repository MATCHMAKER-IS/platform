# @platform/saga

複数の処理をまとめて実行し、**失敗したら順に打ち消す**仕組み。

## これは何のためか

**DB のトランザクションが効かない範囲**のためのものです。

「在庫を引く → 決済する → 通知する」——
**決済で失敗したら、在庫を戻す**必要があります。

## 使う前に知っておくこと

| | |
|---|---|
| **打ち消しは逆順** | 成功した分だけを、**後ろから**打ち消します |
| **打ち消しも失敗します** | 1 つ失敗しても、**他の打ち消しは続けます**——**途中で止めると、もっと中途半端**になります |
| **完全には戻りません** | 「メールを送った」は取り消せません——**外部への通知は最後に**置いてください |
| **打ち消せない処理を途中に置かない** | 順序を考えるのが**設計の要**です |

## よく使うもの

```ts
import { runSaga, sagaStep } from "@platform/saga";
import { runSaga, sagaStep } from "@platform/saga";
const result = await runSaga([
  sagaStep("在庫引当", (c) => reserve(c), (c) => release(c)),
  sagaStep("決済", (c) => charge(c), (c) => refund(c)),
  sagaStep("メール送信", (c) => notify(c)),  // 補償不要な最終ステップ
], ctx);
if (!result.ok) console.warn(`失敗: ${result.failedStep}、補償済: ${result.compensated.join(",")}`);
```

補償自体が失敗した場合は `compensationErrors` に記録され、処理は継続します(取りこぼしの検知用)。
