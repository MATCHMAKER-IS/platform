# @platform/faker

試験用のダミーデータ（氏名・住所・金額・日付）。

## これは何のためか

**本番のデータを開発機に持ってこない**ためのものです。

「テストのために本番のコピーを使う」——
**個人情報が開発機に散らばり、消し忘れます**。

## 使う前に知っておくこと

| | |
|---|---|
| **本番データの穴埋めに使わない** | 「とりあえずダミーで埋める」と、**気づかれずに本番に残ります** |
| **秘密の生成には使わない** | 乱数の質が**暗号用ではありません**——鍵やトークンには `@platform/crypto` を使ってください |
| **見て分かる形にする** | 「山田太郎」より「テスト太郎」——**本物と紛れない**ようにしてください |
| **同じ種を渡せば同じ結果** | テストが**毎回違う結果**になると、失敗を再現できません |

## よく使うもの

```ts
import { setSeed, japaneseName, companyName } from "@platform/faker";
import { seedMany, japaneseName, email, address, setSeed } from "@platform/faker";
setSeed(1); // 再現可能にしたいとき
const customers = seedMany(100, () => ({ name: japaneseName(), email: email(), address: address() }));
```

> テストの固定値は `@platform/testing` のファクトリを使ってください。
> こちらは「現実的なダミーを量産する」用途です。
