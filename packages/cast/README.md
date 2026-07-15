# @platform/cast

キャスト(スタッフ/タレント)の基盤処理。一覧の絞り込み(タグ)・並び替え(注目/評価/新人)・
注目/新人抽出、プロフィール組み立て・充実度。SNS 連携は `@platform/social`、予約の空き枠は
`@platform/booking`、表示は `@platform/ui` と組み合わせます。すべて純ロジック。

## 一覧・絞り込み・並び替え
```ts
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

