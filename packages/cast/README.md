# @platform/cast

出演者・スタッフの管理（プロフィール・タグ・評価）。

## これは何のためか

**人を検索して、条件で絞る**ためのものです。

イベントや制作の現場で、**誰に頼むかを選ぶ**のに使います。

## 使う前に知っておくこと

| | |
|---|---|
| **一覧を返す前に必ず絞る** | 公開してよいものだけを返してください——**非公開のプロフィールが漏れます** |
| **タグは「いずれか」と「すべて」を区別** | `OR` と `AND` で**結果が大きく変わります**——**どちらか明示**してください |
| **評価は件数と一緒に見る** | 「5.0（1 件）」と「4.5（100 件）」では、**後者の方が信頼できます** |
| **個人情報が多い** | 氏名・連絡先・写真——**保存期間と公開範囲を必ず決めて**ください |

## よく使うもの

```ts
import { activeCasts, castsByTag, castsByAllTags } from "@platform/cast";
import { activeCasts, castsByTag, sortCasts, featuredCasts, newcomers, tagCounts } from "@platform/cast";

activeCasts(casts);                     // 在籍中のみ
castsByTag(casts, "ダンス");             // タグで絞り込み
sortCasts(casts, "featured");           // 注目→評価順(他に "rating" / "newest" / "name")
featuredCasts(casts, 6);                // 注目キャスト(トップページ用)
newcomers(casts, 30);                   // 入店30日以内の新人
tagCounts(casts);                       // タグ一覧(絞り込みUI用・多い順)
```

## プロフィール
```ts
import { profileItems, profileCompleteness, hasRequiredProfile } from "@platform/cast";

const fields = [{ key: "name", label: "名前" }, { key: "tags", label: "得意" }, { key: "height", label: "身長" }];
profileItems(cast, fields);             // 値のある項目だけを { label, value } で(詳細表示用)
profileCompleteness(cast, fields);      // 充実度 0〜1(プロフィール入力の進捗表示)
hasRequiredProfile(cast, ["name", "tags"]);   // 公開に必要な項目が揃っているか
```

## 組み合わせ
- SNS リンク: `@platform/social` の `accountsFromUrls` / `accountLinks` でキャストの X/TikTok/Instagram を表示。
- 空き枠: `@platform/booking` の `availableSlots` でキャスト指名予約の空きを表示(capacity=1)。
- SNS 最新投稿: `@platform/social` の `latestPerPlatform` でプロフィールに最新投稿を埋め込み。

## 口コミ連動ランキング
評価と件数を加味した重み付きスコア(ベイズ平均)で並べます。件数の少ない高評価が上位を独占しません。
```ts
import { rankCasts, rankByRawRating } from "@platform/cast";

rankCasts(casts, { minCount: 10, limit: 10 });   // 口コミ件数を考慮した総合ランキング
rankByRawRating(casts, 10);                       // 単純平均の高評価順(同点は件数の多い順)
```
口コミの集計(平均・分布)は `@platform/commerce` の `ratingSummary` と併用できます。

