# loadtest-scenarios（負荷シナリオ集）

実際の業務パターンを模した負荷シナリオです。「何 req/s 出るか」だけ測っても意味は薄く、**業務で実際に起きる形**で負荷をかけて初めて「朝の打刻に耐えられるか」が分かります。

`@platform/loadtest` の `runScenario` に渡して使います。

## 用意しているシナリオ

| 名前 | 想定する場面 | 推奨設定 | 見るべき指標 |
|---|---|---|---|
| `morning-rush` | **朝 9:00 の一斉打刻**。書き込みが一点集中 | 並列 200 / 60秒 / ランプ無し | **エラー率と p99**。ロック競合で一部が極端に遅くなる |
| `expense-rush` | **月初の経費申請ラッシュ**。読み書き混在 | 並列 50 / 120秒 / ランプ 10秒 | **一覧のステップ別 p95**。ここが遅いと全体が遅い |
| `normal-day` | 日中の平常運転。読み取りが大半 | 並列 30 / 300秒 / ランプ 30秒 | **p95 が時間とともに悪化しないか**（リーク・接続枯渇） |
| `monthly-closing` | 月次決算。1 本が重い | 並列 2 / 180秒 | **max**。タイムアウトしないか |
| `health` | 疎通と基礎レイテンシ | 並列 10 / 10秒 | まずこれで足場を確認 |

## 使い方

```ts
import { runScenario } from "@platform/loadtest";
import { morningRush, buildHttpStep, scenarioGuide, formatSteps } from "@demos/loadtest-scenarios";

const step = buildHttpStep({
  baseUrl: "http://localhost:3000",
  cookie: "session=...",   // 認証が要る API を叩くなら
});

const g = scenarioGuide["morning-rush"];
const result = await runScenario(morningRush(step), {
  concurrency: g.concurrency,
  durationMs: g.durationMs,
  rampUpMs: g.rampUpMs,
});

console.log(`エラー率 ${(result.errorRate * 100).toFixed(1)}% / p95 ${Math.round(result.latency.p95)}ms`);
console.log(formatSteps(result.steps));
```

出力例:

```
ステップ           件数   成功   失敗   p50    p95    max
打刻(出勤)          9821   9820      1   38ms  180ms  2100ms
自分の勤怠確認       2455   2455      0   12ms   45ms   210ms
```

この例だと **max 2100ms** が要注意です。「たまに 2 秒待たされる人がいる」ということなので、ロック競合を疑います。

## 読み方のコツ

- **平均を見ない。** 外れ値に引きずられて実態を隠します。**p95** を見ます
- **ステップ別に見る。** 全体の p95 が良くても、特定の API だけ遅いことがあります
- **エラー率が 0% でないなら、まずそれを解決。** 遅さの議論はその後です
- **絶対値より変更前後の比較。** 開発機の性能に依存するので、「改善したか」を見ます

## 注意

- **本番環境に向けて撃たないでください。** 本物の障害になります
- 開発環境（`pnpm dev`）は本番より遅いので、絶対値は参考程度に
- 本格的な負荷試験（分散・長時間）には [k6](https://k6.io/) 等の専用ツールを推奨

## 独自シナリオの作り方

```ts
import type { Scenario } from "@platform/loadtest";
import { buildHttpStep } from "@demos/loadtest-scenarios";

export function myScenario(step: ReturnType<typeof buildHttpStep>): Scenario {
  return {
    steps: [
      { name: "一覧", weight: 7, request: step("/api/items") },
      { name: "登録", weight: 3, request: step("/api/items", { method: "POST", body: JSON.stringify({ name: "x" }) }) },
    ],
  };
}
```

`weight` は相対値です（7:3 なら 7 割が一覧）。**実際のアクセス比率に合わせる**のが大事です。

---

**関連**: [テストとデバッグ](../../docs/ops/TESTING_GUIDE.md) / [@platform/loadtest](../../packages/loadtest/README.md)
