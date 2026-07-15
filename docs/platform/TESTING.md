# テスト方針（多層防御）

このモノレポは、実行環境の制約下でも品質を担保できるよう、テストを層で重ねている。

## 1. 型チェック（第一の門番）
- `tsc --noEmit` を全パッケージ・アプリで実行。`strict` + `noUncheckedIndexedAccess` で境界の抜けを検出。
- 基盤(packages/)は純ロジック中心のため、型が仕様の大部分を保証する。
- 実行コマンド: 各パッケージ `pnpm typecheck`、ルート `pnpm -r typecheck`。

## 2. 単体テスト（vitest）
- 純ロジックは `*.test.ts` で網羅。境界値・端数処理・状態遷移を重点的に。
- 例: `@platform/invoice` の税率区分ごとの端数処理、`@platform/booking` の空き枠、`@platform/auth` の RBAC。
- 実行: `pnpm -r test`。

## 3. スモークハーネス（tools/smoke.mjs）
- ネットワーク/フルビルド不可の環境向けに、主要パッケージの純ロジックを 1 プロセスで通し検証する。
- 相互依存は実ソースを一時展開して結線し、**実際のパッケージ間連携**（例: invoice × tax）も検証する。
- 実行: `pnpm smoke`（`node --experimental-strip-types tools/smoke.mjs`）。期待値は VERIFY.md に記録。
- 依存関係の健全性は `node tools/check-deps.mjs`（循環依存・層破りの検出）。

## 4. 結合テスト（アプリ層・Playwright E2E）
- `apps/internal-app/e2e/*.spec.ts` に主要業務フローの E2E を置く（例: 経費申請フロー、ログイン→ダッシュボード）。
- `playwright.config.ts` で起動。CI では `next build` 後に `playwright test`。
- 対象: 認証（ソーシャルログイン）、権限による画面出し分け、フォーム送信→トースト、一覧の検索/ページャ。

## 5. 契約・可観測性
- API サーフェスは `tools/api-surface.mjs --update` で追跡し、破壊的変更を差分で検知。
- 実行時は `@platform/observability` / instrumentation でメトリクス・トレースを収集（OBSERVABILITY.md 参照）。

## 層の対応表
| 変更対象 | 主に効く層 |
| --- | --- |
| 基盤の純ロジック | 型 + 単体 + スモーク |
| パッケージ間連携 | スモーク（実ソース結線）+ 型 |
| 画面・配線 | 型 + Playwright E2E |
| 破壊的変更の検知 | api-surface 差分 + check-deps |

原則: **速い層で多くを捕まえ、E2E は代表フローに絞る**。純ロジックを基盤へ寄せることで、
アプリ側の E2E を薄く保てる（属人化・ブラックボックス化の抑止にも寄与）。
