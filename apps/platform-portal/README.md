# platform-portal — 基盤ポータル

社内基盤(packages)を **AI も人も探しやすくする**ための1画面ポータル。壁打ちの最優先3点のうち「Platform Portal」の最小版です。

## 見られるもの

- **パッケージカタログ**: 99 パッケージを名前・説明・export・カテゴリで**検索/絞り込み**(module-list と api-surface が情報源)
- **ヘルス**: `tools/platform-report.mjs` のヘルス指標(テスト保有率・公開API数など)
- **ADR**: 設計判断の一覧(docs/adr)

## 起動

```bash
pnpm --filter platform-portal dev   # http://localhost:3005
```

## 仕組み

`src/server/catalog.ts` が**リクエスト時にリポジトリの成果物**(docs/platform/api-surface.json / docs/ai/module-list.md / packages/*/README.md / docs/ai/platform-report.md / docs/adr/*.md)を読み、`/api/catalog` が JSON で返します。ビルド時固定ではないため、`pnpm gen:module-list` や `platform-report` を再生成すれば Portal も最新化されます。認証なし(社内閲覧前提)。

## 今後(ROADMAP P3)

Reference(TypeDoc)埋め込み、Package Finder/重複検出(Advisor)、GitHub Issues 連携、AI チャット(基盤について質問)を足していく土台。
