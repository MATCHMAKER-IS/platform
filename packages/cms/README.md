# @platform/cms

社内のお知らせ・記事（下書き・公開予約・版管理）。

## これは何のためか

**「誰がいつ何を変えたか」が残らないと、お知らせは信用されません。**

「前はこう書いてあった」と言われたときに、**確かめられる**必要があります。
このパッケージは**版を残し、公開前の下書きをサーバに保つ**ためのものです。

## 使う前に知っておくこと

| | |
|---|---|
| **下書きはサーバに保存されます** | タブを閉じても消えません——**書きかけを失う**事故を防ぐためです |
| **公開予約は「その時刻に自動で出る」** | **定期実行が止まっていると出ません**。予約したら**当日に確認**してください |
| **画像は `loading="lazy"`** | 付けないと、**一覧に 50 件並べば 50 枚を一度に取りに行きます** |
| **消しても版は残ります** | 「間違って公開した」を**なかったことにはできません**——訂正のお知らせを出してください |

## よく使うもの

```ts
import { cmsPostToBlog, liveBlogViews, isAnnouncementLevel } from "@platform/cms";
import {
  createMemoryCmsStore, validatePostInput, effectiveStatus, isLive,
  diffRevisions, buildPreviewUrl,
} from "@platform/cms";

const store = createMemoryCmsStore();

// 保存する前に検証する（スラッグの重複・空のタイトルなど）
const check = validatePostInput(input);
if (!check.ok) return showErrors(check.errors);

// 「今この記事は公開されているか」は毎回計算する。
// status を持ち回ると、予約公開の時刻を過ぎても下書きのままになる
const status = effectiveStatus(post);      // "draft" | "scheduled" | "published"
const visible = isLive(post);
```

### 公開前に確認してもらう

```ts
// 下書きの確認用 URL。**期限つきの token を付けて拡散を防ぐ**
const url = buildPreviewUrl(baseUrl, post.slug, token);

// 何が変わるかを見せてから承認してもらう（行単位の差分）
const diff = diffRevisions(before, after);
```

## 押さえていること

| 点 | 内容 |
|---|---|
| **公開状態は計算する** | `status` を保存すると、予約時刻を過ぎても更新されない。`effectiveStatus` が時刻から判定する |
| **保存先を差し替えられる** | 開発はメモリ、本番は Prisma（`createMemoryCmsStore` / `createPrismaCmsStore`） |
| 改訂を残す | 誰がいつ何を変えたかを追える。差分は行単位（LCS） |
| 社内と社外で共通 | お知らせ（社内）と記事（公開サイト）が**同じ基盤**を使う |

## 扱わないこと

- **画面** … `apps/internal-app` の CMS 管理、`apps/public-site` の記事表示
- **本文の整形** … `@platform/html`（危険なタグの除去を含む）
