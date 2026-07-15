# リファレンスサイト（自動生成）

`node tools/gen-ref-site.mjs`（または `pnpm gen:site`）で生成される、人間が読むための HTML リファレンスです。

- `index.html` — 基盤パッケージ一覧（検索可）＋公開 API ＋依存グラフ
- `app-<name>.html` — 各アプリの画面・API 一覧

ブラウザで `index.html` を開くだけで閲覧できます（外部依存なし・オフライン可）。
内容は既存の生成物（api-reference.json / depgraph / appmap）を統合しているので、
それらを再生成した後に `gen:site` を実行すると最新になります。
