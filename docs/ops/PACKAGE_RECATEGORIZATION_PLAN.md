# packages 物理カテゴリ再配置 — 段階移行計画

## 方針(重要な設計判断)

- **npm 名 `@platform/<name>` は不変**。変わるのは物理パスのみ(`packages/<name>` → `packages/<slug>/<name>`)。
  → アプリ・パッケージの **import 文は 1 行も変更不要**(workspace 解決は package.json の name で行われるため)。
- カテゴリとスラッグの単一情報源は `tools/package-categories.mjs`(module-list 生成と共用)。
- 影響するのは「**パスを直書きしている場所**」だけ: 計測は `node tools/migrate-packages.mjs`(dry-run)で常に最新を確認できる。現時点の実測では **tools/smoke.mjs のみ**(合成テストが `../packages/<name>/src/...` を読むため。例: 外部SaaS 7個で 41 箇所)。

## フェーズ

### Phase 0: 前提
CI が緑(docs/ops/CI_FIRST_RUN.md 完了)。移行はブランチ+PR 単位、1 バッチ=1 カテゴリ。

### Phase 1: ツールのパス解決を抽象化(移動より先)
`tools/pkg-path.mjs` を新設: `resolvePackageDir(name)` が `packages/**/package.json` を走査して name→実パスを返す(起動時1回キャッシュ)。
- `smoke.mjs`: `rdc("../packages/<p>/src/…")` の `<p>` 部分を `resolvePackageDir` 経由に一括置換(`sed -E 's#\.\./packages/([a-z-]+)/src#…#'` 相当。~40箇所/カテゴリ)。
- `check-deps.mjs` / `api-surface.mjs` / `gen-module-list.mjs` / `gen-readmes` 系: ディレクトリ走査を `packages/*` → `packages/{*,*/*}` 対応に。
- CI の `--schema=../../apps/...`(packages/db 起点)は移動後 `../../../apps/...` になるため、**リポジトリルート起点の絶対指定**へ変更(`--schema=$GITHUB_WORKSPACE/apps/internal-app/prisma/schema.prisma`)。
- 完了条件: この時点で(まだ何も移動せず)smoke/check-deps/api-surface が緑。

### Phase 2: パイロット移行(外部SaaS連携・7個)
1. `pnpm-workspace.yaml` に `"packages/*/*"` を追加(既存 `packages/*` と併記)
2. `node tools/migrate-packages.mjs --category=外部SaaS連携` の出力どおり `git mv`
3. `pnpm install` → smoke → check-deps → api-surface → typecheck → build(CI で確認)
4. 問題なければマージ。ロールバックは PR revert のみで完結(name 不変のため)。

### Phase 3: 残りカテゴリを順次(依存の少ない順)
推奨順: saas → media → content → ops → flow → comm → data → security/auth → domain → ui-kit → foundation(被依存が最多の foundation を最後に)。各バッチで Phase 2 の 3) を繰り返す。

### Phase 4: 後片付け
- `pnpm-workspace.yaml` から `packages/*` を削除(`packages/*/*` のみに)
- docs 内の旧パス表記を grep で一掃、`gen-module-list` 再生成、STRUCTURE 更新
- 本計画書に完了日を追記

## リスクと対応

| リスク | 対応 |
|---|---|
| smoke 合成の書換え漏れ | Phase 1 で機械的置換+全緑を先に確認。移動時は dry-run の影響一覧と突合 |
| ツール以外の直書き(エディタ設定・個人スクリプト) | dry-run の SCAN 対象を随時追加できる設計 |
| 長期ブランチ化 | 1カテゴリ=1PR・即マージで衝突を回避 |
| git 履歴の追跡 | `git log --follow` で追える(git mv 使用) |

## いま実行しないこと(明示)

本環境(オフライン)では pnpm install を伴う Phase 2 以降の検証ができないため、**計画とツールまで**を成果物とし、実移行は CI 緑化後に行う。
