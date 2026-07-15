# @platform/config

**共有ビルド設定パッケージ**(ランタイムコードは持ちません)。
全パッケージ・アプリが継承する TypeScript / テスト設定を一元管理します。

- `tsconfig.base.json` … 全 tsconfig が `extends` する厳格設定(`strict` / `noUncheckedIndexedAccess` 等)
- `vitest.preset.ts` … 各パッケージの Vitest が読み込むカバレッジ閾値つきプリセット

```jsonc
// packages/xxx/tsconfig.json
{ "extends": "../config/tsconfig.base.json" }
```

設定を1か所に集約することで、パッケージ間の設定ゆれ(strict の抜け等)を防ぎます。
