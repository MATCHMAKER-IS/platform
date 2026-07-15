# コントリビューションガイド

> **Git や GitHub の操作に不慣れな方**は、先に [docs/ops/GIT_GUIDE.md](docs/ops/GIT_GUIDE.md) を読んでください。
> ここは「Git は使える前提」で、このリポジトリ固有の約束を書いています。

## ブランチ / PR

- `main` は保護。直接 push 禁止。**PR + CI 通過 + CODEOWNERS レビュー**が必須。
- 1 PR は 1 目的。**アプリと基盤の変更を混ぜない**(基盤変更は別 PR)。
- ブランチ名は `feat/機能名` `fix/バグ名` `docs/内容` のように、種類/内容 で付ける。

## 変更の流れ

1. **実装前に既存部品を確認する。** `pnpm dev:portal`(:3005)で検索するか、
   AI を使うなら `pnpm mcp:catalog` の `search_platform`。車輪の再発明を避ける。
2. アプリ機能はアプリ側に、汎用部品は基盤側に(基盤化は別 PR)。
3. 公開関数・型に TSDoc を書く。テストを追加する。
4. **`pnpm check`** を通す(型 + Lint + スモーク)。
5. **基盤を変更したら `pnpm platform:check`** — 削除した API を誰が使っているか確認する。
   その後 `pnpm platform:sync` で生成物(カタログ・API 一覧・ER 図)を更新し、同じ PR に含める。
6. 重要な設計判断は `docs/adr/` に ADR を追加する。

> **バージョンは上げません。** このリポジトリは基盤にセマンティックバージョニングを適用しない方針です
> (理由: [ADR 0011](docs/adr/0011-no-versioning-monorepo.md))。破壊的変更は `api-surface` が機械的に検出します。

## 新しい基盤パッケージ

```bash
pnpm scaffold shipping "配送(送り状・追跡)"
```

規約どおりの雛形(package.json / tsconfig / vitest.config / README / テスト)が生成されます。
**手で作らないでください**(設定漏れの原因になります。実際に 14 件見つかりました)。

生成後、`docs/platform/CATALOG.md` と `capabilities.json` に追記します。

## 新しいアプリ

[docs/ops/NEW_APP.md](docs/ops/NEW_APP.md) の手順とチェックリストに従ってください。ポート採番を忘れずに。

## PR を出す前の最終確認

```bash
pnpm check              # 型 + Lint + スモーク(必須)
pnpm verify:offline     # 依存境界・生成物・ポート・設定の整合まで(推奨)
```

CI でも同じものが走ります。手元で通してから出すと、レビューが速くなります。
