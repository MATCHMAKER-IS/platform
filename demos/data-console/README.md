# @demos/data-console — データ一覧の完成テンプレート

検索 + 外部フィルタ + ソート + ページャを備えた一覧 `DataConsole`。
`@platform/ui` の `queryRows`(純パイプライン)と UI 部品を束ねています。

## 構成
| 役割 | 部品 |
| --- | --- |
| 検索/ソート/ページの適用 | `@platform/ui` の `queryRows`(TableQuery → TableResult) |
| 検索窓 | `SearchInput`(onValueChange） |
| 状態フィルタ | `Button`(外部フィルタとして queryRows の前段で適用) |
| ページャ | `Pagination`（page/totalPages/onPageChange） |
| 0 件表示 | `EmptyState` |

## ポイント
- **外部フィルタ(状態)→ `queryRows`(検索+ソート+ページ)** の順でデータを流す。組み込み検索の
  `DataTable` では足りない絞り込み(状態・期間など）を外側で足せる。
- 検索・フィルタ変更時はページを 1 に戻す。ソートは列ヘッダのクリックで昇順/降順トグル。
- 大量データはサーバ側(`repository.paginate`)、取得済みの絞り込みは `queryRows`、という使い分け。

シンプルな一覧なら `DataTable`(検索・ページ・CSV 内蔵)を直接使う方が手軽です。
