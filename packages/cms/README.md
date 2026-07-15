# @platform/cms

CMS(お知らせ・記事・ページ)の共通基盤。投稿モデル・下書き/公開/予約のステータス管理・改訂履歴・タグ/カテゴリ・公開申請までを部品化しています。

- `CmsPost` / `CmsPostInput` / `isValidSlug` … 投稿モデルとスラッグ検証
- `CmsStore`(`createMemoryCmsStore` / `createPrismaCmsStore`) … 保存(メモリ/Prismaの両実装・切替可能)
- `scheduling` … 予約公開(publishAt)の判定
- `revision` / `diff` … 改訂履歴と差分
- `publish-request` … 公開申請(編集者→承認者)のワークフロー
- `announcement` / `page` / `category-store` / `tags` / `filter` / `summary` … お知らせ・固定ページ・分類・一覧絞り込み

社内アプリ(お知らせ)と公開サイト(ブログ/ページ)の**両方から同じ基盤を使う**のが特徴です。実利用例: apps/internal-app の CMS 管理画面、apps/public-site の記事表示。
