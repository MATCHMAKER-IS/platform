# 新パッケージの作り方（scaffold）

属人化・ブラックボックス化を防ぐため、新しい基盤パッケージは雛形から始める。

## 生成
```bash
node tools/scaffold.mjs <name> "<summary>"
# 例: node tools/scaffold.mjs shipping "配送(送り状・追跡)"
```
`packages/<name>/` に以下が生成される:
- `package.json` / `tsconfig.json`（規約準拠）
- `src/index.ts`（バレル）/ `src/<name>.ts`（実装）/ `src/<name>.test.ts`（テスト雛形）
- `README.md`（方針テンプレ）

## 実装〜登録の流れ
1. `src/<name>.ts` に**純ロジック**を実装（外部 I/O は注入可能に）。
2. ネットワーク制限下では `node --experimental-strip-types` で直接 import して動作確認。
3. 局所 `tsc --noEmit` で型チェック（`strict` + `noUncheckedIndexedAccess`）。
4. `tools/smoke.mjs` にスモークを追加（相互依存は実ソースを一時展開して結線）。
5. `docs/platform/capabilities.json` に登録、`docs/platform/CATALOG.md` に 1 行追加。
6. `node tools/check-deps.mjs` で**循環依存・層破り**がないことを確認。
7. パッケージ数を README/docs に反映。

## 原則
- **基盤はロジック、アプリは組み合わせ**。ドメインの計算は package に寄せ、apps/demos は配線に徹する。
- 依存の向きを一方向に保つ（下位 util → 上位ドメイン）。逆流は check-deps が検出。
- テストは「速い層で多く捕まえる」（型 → 単体 → スモーク → E2E）。詳細は TESTING.md。
