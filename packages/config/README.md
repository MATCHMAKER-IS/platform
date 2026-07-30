# @platform/config

**共有ビルド設定パッケージ**(ランタイムコードは持ちません)。
全パッケージ・アプリが継承する TypeScript / テスト設定を一元管理します。

- `tsconfig.base.json` … 全 tsconfig が `extends` する厳格設定(`strict` / `noUncheckedIndexedAccess` 等)
- `vitest.preset.mjs` … 各パッケージの Vitest が読み込むカバレッジ閾値つきプリセット

```jsonc
// packages/xxx/tsconfig.json
{ "extends": "../config/tsconfig.base.json" }
```

設定を1か所に集約することで、パッケージ間の設定ゆれ(strict の抜け等)を防ぎます。

## テストが無い理由

このパッケージは **tsconfig と vitest のプリセットだけ**で、ランタイムコードを持たない
(`src/` が無い)。検査する対象が無いため、テストは置かない。

`node tools/check-package-shape.mjs` も明示的に対象外にしている
(「テストが無いパッケージ」を数えるときは、ここを除いて **112 件**が母数)。
