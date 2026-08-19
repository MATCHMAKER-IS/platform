# 外部レビュー（2026-08）と現状の照合

社外の AI（ChatGPT）に基盤を評価してもらった際の指摘を、**リポジトリの実態と突き合わせて**整理したものです。

## この資料の読み方

**指摘そのものを鵜呑みにしないでください。** 評価者はリポジトリの中身を見ずに
一般論として書いているため、**既にあるものを「無い」と指摘している項目が大半**です。
そのまま作業リストにすると、**作り直しになります**。

各項目に判定を付けました。

| 記号 | 意味 |
|---|---|
| ✅ | **既にある**。作らないこと |
| 🔶 | 部分的にある。伸ばす余地あり |
| ❗ | **本当に足りない**。着手対象 |
| ⛔ | **意図的にやらない**。理由あり |

---

## いちばん重要な指摘（❗）

> 「コード上は正しそう」で止まらず、「実際に動くことを確認できる仕組み」が必要

**これは正鵠を射ています。2026-08 に実際に起きました。**

```
pnpm typecheck  → 緑
pnpm test       → 緑（2,798 件）
pnpm check      → 緑（102 種類）
pnpm build      → 5 アプリすべて失敗
```

`node:crypto` が Edge に載らない・`route.ts` が `spec` を export できない・
`"use client"` の位置——**どれもビルドするまで分からないもの**でした。

**教訓**: 「検査が緑」は「動く」ことを何も保証しません。
`pnpm build` を品質ゲートに含めるべきです（→ 改修候補 A）。

---

## 分野ごとの判定

### 実行検証・CI/CD

| # | 指摘 | 判定 | 現状 |
|---|---|---|---|
| 1 | 本番相当の実行検証 | ❗ | **`pnpm check` にビルドが含まれない**。上記のとおり実害が出た |
| 1 | E2E | ✅ | spec 10 本 / `@axe-core/playwright` は devDependencies に宣言済み / `.github/workflows/e2e.yml` が `playwright install` → 実行まで通す。**「未インストール」という以前の記述は誤り**で、実際は `pnpm install` を流していない環境で見ていただけでした（2026-08 訂正） |
| 2 | CI/CD 品質ゲート | ✅ | `.github/workflows/` に 14 本（ci / codeql / contract / e2e / security / pr-review / release ほか） |

### 認証・認可・セキュリティ

| # | 指摘 | 判定 | 現状 |
|---|---|---|---|
| 3 | 認証・認可 | ✅ | `auth` / `guard` / `session` / `apikey`。`check-api-auth` が**認可漏れを検査** |
| 4 | RAG の権限制御 | ✅ | `packages/rag` に権限・テナント分離あり |
| 12 | セキュリティ | ✅ | `check-unsafe-html` / `check-rate-limit` / `check-security-headers` / codeql |
| 9 | Secret 管理 | ✅ | `packages/secrets`、`docs/ops/SECRET_ROTATION.md` |
| 11 | PII | ✅ | `packages/pii`（伏せ字・保持期限・開示・削除） |

### AI

| # | 指摘 | 判定 | 現状 |
|---|---|---|---|
| 5 | AI Gateway | ✅ | `packages/ai/src/gateway.ts`。**直接呼び出しは ADR-0010 で禁止** |
| 6 | AI コスト管理 | ✅ | `packages/ai/src/governance.ts` に `createSpendingLimiter` / 決定ログ / 同時実行制限 |
| 7 | MCP | ✅ | `packages/mcp` |
| 15 | AI 品質評価 | 🔶 | 仕組みはあるが**回帰の自動検証は弱い**。Phase 2 |

### 開発支援

| # | 指摘 | 判定 | 現状 |
|---|---|---|---|
| 18 | Platform Advisor | ✅ | `search_platform` / `check-reimplementation`。**ただし使われないと意味がない**（下記） |
| 19 | Package 重複防止 | ✅ | 同上 |
| 20 | Reference サイト | ✅ | `docs/site/`（アプリ別ページつき・`gen-ref-site.mjs` で生成） |
| 21 | Generator | ✅ | `pnpm new-app`（機能 26 / 部品 60 を選択可） |
| 24 | AI が理解しやすい | ✅ | `CLAUDE.md` / `HANDOVER.md` / ADR 25 本 / 102 種類の検査 |

### 構造・運用

| # | 指摘 | 判定 | 現状 |
|---|---|---|---|
| 25〜27 | Apps 開発ルール・責務分離 | ✅ | `docs/ops/APPS_VS_FOUNDATION.md`、`check-deps`（層破り検査） |
| 28 | バージョニング | ✅ | `platform.tier`（stable 95 / incubating 25） |
| 32 | 依存管理 | ✅ | `check-deps`（循環・層破り）/ `check-unused-deps` / `check-version-drift` |
| 33〜34 | 肥大化・過剰共通化 | 🔶 | tier はあるが、**「基盤に入れる基準」の明文化は薄い** |
| 35 | Observability | ✅ | `packages/observability` |
| 37〜38 | Job / Event Bus | ✅ | `jobs` / `cron` / `saga` |
| 40 | API 仕様書 | 🔶 | `openapi` あり。**宣言は 291 本中 6 本**（残りは画面専用で意図的） |
| 45 | Backup / DR | ✅ | `docs/ops/BACKUP_RESTORE.md`、`scripts/backup.sh` |
| 46〜48 | 環境分離 / 設定 / Feature Flag | ✅ | `env` / `config` / `flags` |
| 50 | Golden Path | ✅ | `scripts/setup.sh` / `setup.ps1` / `setup.bat` |

---

## 指摘に**書かれていない**、実際の弱点

外から見ただけでは分からないものです。**こちらの方が優先度が高い。**

### 1. 検査自身の被覆が偏っている（❗）

2026-08 の 1 セッションだけで、**検査が緑なのに中身が空**という事例が 3 件出ました。

- `check-build-ready` が「import 解決」を謳いながら**1 アプリしか見ていなかった**
- 同じ検査が**副作用だけの import（`import "./x";`）を拾っていなかった**
- `check-tsdoc-params` の `splitTop()` が**文字列内のカンマで壊れていた**

`verify-checks`（違反を置いて赤くなるか確かめる）は **76 件**で、
**102 種類の 3 分の 1 は未検証**です（2026-08 に 68 → 76 へ）。

### 2. 期限付きの決定が宙に浮いている（❗）

- **Next.js 15 のサポートは 2026-10-21 まで**（ADR-0025）。
  Amplify が 16 に対応しないなら、**置き先の判断が要ります**
- `internal-app` の `runtime = "nodejs"` が Amplify で動くか**未確認**

### 3. 「基盤を作る人」が基盤を使っていない（❗）

2026-08 に、デモ用 API を 4 本作る間に `clientKey`（3 行）を**毎回コピー**しました。
数えると `showcase` に 9 個、さらに `@platform/guard` と 2 つの
`server/rate-limit.ts` に**同じものが既にありました**。

**Platform Advisor は、書く側が使わなければ意味がありません。**
`check-reimplementation` が最終的に捕まえましたが、**書く前に探す**のが本来です。

### 4. 束ねた入口は「実行できる場所」で割れる（✅ 対応済・再発注意）

`security` / `pii` / `pdf` / `ekyc` / `line` / `dencho` / `crypto` / `form` の
**8 パッケージ**で、`node:` に届くファイルと純粋なファイルが同じ入口にありました。
`check-runtime-boundary`（102 種類目）で 0 件にしましたが、
**新しいパッケージを作るときは最初から分けてください**（後から分けると
smoke の写し取りにも響きます——`line` では 7 か所）。

---

## ⛔ 意図的にやらないこと

| 指摘 | やらない理由 |
|---|---|
| 全 API を OpenAPI に載せる | **画面専用の API まで載せると、本当に使ってよいものが埋もれます**。外部システムが参照するものだけ（291 本中 6 本） |
| 大きいファイルの分割 | `tools/smoke.mjs` 等は「関数の集まり」。分けても読みやすくなりません |
| 長い行 1,363 行の一括整形 | 内訳の 764 件は `return { ... }` 等。**機械的な折り返しは危険の割に得るものがない**（1 行に押し込まれた `interface` 6 件だけ直した） |

---

## 改修の優先順位（この資料時点）

評価者の「特に重要な 5 つ」に対する、こちらの判断です。

| 評価者の提案 | 判断 |
|---|---|
| ①Golden Path | **最優先。ただし `pnpm build` の品質ゲート組み込みが先** |
| ②基盤/Apps 境界 | 実現済み（`check-deps` / `check-reimplementation`） |
| ③AI 品質ゲート | Phase 2。**先にビルドが通ること** |
| ④Package 増加への耐性 | 実現済み（tier / 依存グラフ / debt ラチェット） |
| ⑤Claude Code が保守できる | 実現済み（CLAUDE.md / HANDOVER / 102 検査） |

**いま効くのは、増やすことではなく「緑の意味を強くする」ことです。**

### 着手候補

- **A. ビルドで初めて落ちる形を、検査で先に止める**（✅ 2026-08 着手）
  CI には既に Build があるので、**手元で 30 分待たずに同じ誤りを止める**方を選びました
  （`public-site` 単体で 9.8 分。全アプリを `pnpm check` に入れると使われなくなります）。
  `check-build-ready` に **A7（`"use client"` の位置）** と
  **A8（`route.ts` の余分な export）** を追加。
  **今回ビルドを落とした 4 種類のうち 3 種類**は、これで手元で止まります
  （残る `node:` の巻き込みは `check-runtime-boundary` が担当）。
- **B. `verify-checks` の被覆を上げる**（🔶 2026-08 に一部着手）
  76 / 102。**「上限ラチェットだから確かめられない」は、上限が 0 のときは当てはまりません**
  ——0 を超えた時点で落ちるので普通に検証できます。この誤解で **6 件**が除外されていました。**除外理由は 3 種類に分けられます**——
  ①上限が 0 なので実は落ちる（`check-query-in-loop` / `check-input-validation` / `check-handmade-chart`）
  ②理由が書かれておらず、ただの説明（`check-package-tier` / `check-deps`）
  ③「区別が要る」（`check-reimplementation`。**区別の仕組み（ALLOW）はある**）。
  **残る 34 件のうち、本当に無理なのは「リポジトリ唯一のファイルを壊すしかない」もの**です
  （`check-ops-hygiene` / `check-migration-mode` / `check-rollback-ready` など）。
- **C. E2E**（✅ 確認したところ、既に動く状態でした）
  spec 10 本の構文を確認、依存の宣言と CI の手順も揃っていました。
  **足りないのは E2E ではなく `pnpm-lock.yaml` のコミット**です
  ——`e2e.yml` に `# TODO: pnpm-lock.yaml をコミットしたら --frozen-lockfile に戻す`
  が残っており、**いまの CI は毎回依存を解決し直しています**（遅く、再現しません）。
- **D. Next 15 EOL への判断**（❗期限あり）
  2026-10-21。ADR-0025 に選択肢を書いてあります。

---

## 元の指摘全文

`docs/ops/EXTERNAL_REVIEW_2026-08_RAW.md` に置いてあります。
**上の判定を読まずに原文だけ見ないでください**——既存機能を作り直すことになります。
