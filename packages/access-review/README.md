# @platform/access-review

権限の棚卸し（アクセスレビュー）と、退職・異動時の停止手順。

`@platform/auth` が「**今この人が何をできるか**」を判定するのに対し、
こちらは「**なぜその権限を持っているのか・いつまで持ってよいのか**」を扱います。

```ts
import { reviewAccess, offboardingSteps } from "@platform/access-review";

const findings = reviewAccess(people, grants, today);
const urgent = findings.filter((f) => f.severity === "high");   // 今すぐ対応

const steps = offboardingSteps(resignedPerson, grants);          // 退職時にやること（順序つき）
```

## 何を見つけるか

| 深刻度 | 見つけるもの |
|---|---|
| **high** | 退職者に残った権限 / 名簿に無い利用者の権限 / 期限切れ / 期限の無い強い権限 |
| **medium** | 休職者の権限 / 長く見直していない権限 / 強い権限の期間が長すぎる |
| **low** | 付与の理由が記録されていない |

## 退職時は順序が大事

**セッションの無効化が先**です。権限だけ消してもセッションが生きていれば操作できます。

1. セッションを無効化 → 2. ログインを止める → 3. 権限を外す → 4. 引き継ぎの確認 → 5. 記録を残す

4 を飛ばすと、その人だけが持っていた承認権限が空席になり**業務が止まります**。

## 方針は ADR にあります

`docs/adr/0017-access-review.md` に、半年ごとの棚卸し・強い権限の期限・退職時の期限（最終出社日のうち）を定めています。
このパッケージはその方針を支える道具で、**運用そのもの**（誰が確認するか）は決めごとの側にあります。
