# @platform/cms

CMS(お知らせ・記事・ページ)の共通基盤。投稿モデル・下書き/公開/予約のステータス管理・改訂履歴・タグ/カテゴリ・公開申請までを部品化しています。

- `CmsPost` / `CmsPostInput` / `isValidSlug` … 投稿モデルとスラッグ検証
- `CmsStore`(`createMemoryCmsStore` / `createPrismaCmsStore`) … 保存(メモリ/Prismaの両実装・切替可能)
- `scheduling` … 予約公開(publishAt)の判定
- `revision` / `diff` … 改訂履歴と差分
- `publish-request` … 公開申請(編集者→承認者)のワークフロー
- `announcement` / `page` / `category-store` / `tags` / `filter` / `summary` … お知らせ・固定ページ・分類・一覧絞り込み

社内アプリ(お知らせ)と公開サイト(ブログ/ページ)の**両方から同じ基盤を使う**のが特徴です。実利用例: apps/internal-app の CMS 管理画面、apps/public-site の記事表示。

## 使い方

```ts
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
