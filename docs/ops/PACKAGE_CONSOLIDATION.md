# 基盤パッケージの統廃合 — 現状分析と計画

> 実測日: 2026-07-22 / 対象: `packages/*` 120 パッケージ・約 52,000 行

## 先に結論

**「多すぎるから減らす」のではなく、「同じことが2か所にある状態を無くす」ことを目的にする。**

数を減らすこと自体には価値がない。困るのは、探したときに**どちらを使えばいいか分からない**状態と、
**片方だけ直して片方が古いまま**になる状態である。実測すると、まさにそれが起きていた。

## 実測データ

| 区分 | 数 | 意味 |
|---|---|---|
| 実アプリ(`apps/`)で使用 | 64 | 実運用で動いている |
| デモでしか使われていない | 26 | 作ったが、まだ実業務では使っていない |
| 他パッケージからのみ使用 | 4 | 内部部品として機能している |
| 誰にも使われていない | **0** | 死んだコードは無い |

死蔵パッケージはゼロだった。つまり**「作りっぱなし」の問題は無い**。
一方で、次の重複が見つかった。

### 見つかった重複（実害があるもの）

| 機能 | 実装が存在する場所 | 問題 |
|---|---|---|
| `parseQuery` | `@platform/net` と `@platform/url` | **戻り値の型が違う**。net は `Record<string,string>`、url は重複キーを配列で返す。後者が正しい |
| `joinUrl` | `@platform/net` と `@platform/blog`(内部) | 同じ処理が2つ。片方を直しても、もう片方は古いまま |
| クエリ組み立て | net の `buildQuery` / url の `stringifyQuery` | **名前が違うだけの同じ機能** |
| クエリ追加 | net の `withQuery` / url の `setParams` | 同上 |
| ~~郵便番号の整形~~ | `@platform/address` と `@platform/validation` | **重複ではなかった**（下記「調べ直して取り下げた案」を参照） |

`net` の URL 関連 4 関数のうち **3 つが `url` と重複**していた。
「URL を扱いたい人は net と url のどちらを見るのか」に答えられない状態だった。

## 実施済み（パイロット）

**URL 文字列の操作を `@platform/url` に集約した。**

- `joinUrl` を `packages/url/src/join.ts` へ移動（url 側に無かった唯一の機能）
- `packages/net/src/index.ts` を削除。`net` は**ネットワーク層**（IP/CIDR・バックオフ・SSE・WebSocket フレーム・TCP/UDP）に専念
- 利用側（デモ・smoke）を新しい配置へ更新
- `node tools/api-surface.mjs --update` で公開 API の基準を更新（意図した削除のため）

これで「URL の操作は `@platform/url`」と一言で言える状態になった。

**`apps/internal-app` の独自パスワード実装も基盤へ寄せた。**
`hashPassword` / `verifyPassword` / `generatePassword` が `@platform/crypto` と重複していた。
ただし**保存形式が非互換**だった(旧: hex・scrypt 32byte / 基盤: base64・64byte)ため、
単に差し替えると**既存利用者が全員ログインできなくなる**。
`verifyPassword` は旧形式も受け付け、`needsRehash` が true を返したら
ログイン成功時に新形式へ書き換える、という移行の形にしてある(smoke で固定)。

**`@platform/blog` の独自 `joinUrl` も廃止した。** 同じ処理が 3 か所（net / url / blog）にあったため、
blog は `@platform/url` から取り込んで再輸出する形にした。公開 API は変わらないため、利用側の変更は不要。

> 補足: `tools/smoke.mjs` は依存をインストールせずに実ソースを読むため、
> パッケージをまたぐ import を実パスへ書き換える処理を smoke 側に足している。
> **統廃合で新しくパッケージ間の依存が生まれたときは、smoke の書き換えも必要になる。**

## 今後の候補（未実施）

実行する場合は**1 バッチ 1 テーマ**で、各回 `pnpm check` と実ビルドまで通すこと。

### A. 重複の解消（優先）

URL 周りは解消済み（上記）。現時点で他に**明確な重複は見つかっていない**。

### B. 検討したが、まだ判断していないもの

| 対象 | 規模 | 論点 |
|---|---|---|
| `sequence` | 121 行 | 採番は業務寄り。`utils` か業務パッケージへ寄せる余地がある |
| `saga` / `fsm` | 79 / 121 行 | `workflow` に寄せて「流れの制御」を1か所にできるか |
| `stripe` / `paypal` | 66 / 115 行 | 決済で1つにまとめるか。ADR 0015 の基準 2（差し替える単位）では**分けたままが正しい** |

### 調べ直して取り下げた案

最初の分析には**踏み込みすぎた判断が 2 件**あった。実装を読み直して取り下げる。

| 取り下げた案 | 実際はどうだったか |
|---|---|
| `address` の郵便番号処理を `validation` へ統合 | **重複ではなかった**。`normalizeZipcode` は住所検索のために数字だけへ正規化するもの、`validation` の `formatPostalCode` / `isValidPostalCode` は入力の検証と `123-4567` への整形。役割が違う |
| `units` を `utils` へ吸収 | **小さくなかった**。長さ・重量・面積（坪・畳を含む）・体積・温度の変換を持つまとまった機能で、単位変換という一つの関心事として独立している |

教訓として、**`export function` の数だけを見て小さいと判断しない**（`export const` の関数が数えられない）。
統廃合の判断前に、必ず中身を読む。

### C. 統合しない方がよいもの

- **実アプリで使用中の 64 個** — 動いているものを触る費用対効果が低い
- **Node 専用と ブラウザ可の境界にあるもの** — 混ぜるとビルドが壊れる（`@platform/net/browser` を作った理由と同じ）
- **外部 SaaS ごとのパッケージ** — 相手の都合で個別に壊れるため、分かれている方が影響を閉じ込められる

## 「デモでしか使われていない 26 個」の扱い

これらは**消す対象ではない**。「まだ実業務で使っていない」だけで、必要になったときに使う。
ただし**実運用で検証されていない**ことは事実なので、実アプリに投入する際は素直に疑ってかかる。

対象: address, barcode, blog, cast, currency, dencho, ekyc, faker, form, freee, google,
guard, http, importer, line, loadtest, mobile, net, ocr, phone, saga, sequence, units,
url, validation, zengin

## 判断基準

パッケージを分けるかどうかは、ADR 0015 の基準に従う。要約すると:

1. **依存の重さが違うなら分ける**（Node 専用・重い外部ライブラリ）
2. **差し替える単位が違うなら分ける**（外部 SaaS ごと）
3. **それ以外で、同じ関心事なら 1 つにする**（探すときに迷わないことが最優先）

## 関連

- `docs/adr/0015-package-consolidation-policy.md`（分割の基準）
- `docs/ops/PACKAGE_CONSOLIDATION.md`（物理配置の再編。この文書とは別の話）
- `node tools/check-deps.mjs`（循環依存・層破りの検査）

---

# 分類の見直し

**`PACKAGE_CONSOLIDATION.md` を統合したものです（2026-08）。**

## 方針(重要な設計判断)

- **npm 名 `@platform/<name>` は不変**。変わるのは物理パスのみ(`packages/<name>` → `packages/<slug>/<name>`)。
  → アプリ・パッケージの **import 文は 1 行も変更不要**(workspace 解決は package.json の name で行われるため)。
- カテゴリとスラッグの単一情報源は `tools/package-categories.mjs`(module-list 生成と共用)。
- 影響するのは「**パスを直書きしている場所**」だけ: 計測は `node tools/migrate-packages.mjs`(dry-run)で常に最新を確認できる。現時点の実測では **tools/smoke.mjs のみ**(合成テストが `../packages/<name>/src/...` を読むため。例: 外部SaaS 7個で 41 箇所)。

## フェーズ

### Phase 0: 前提
CI が緑(docs/ops/GITHUB_ACTIONS.md 完了)。移行はブランチ+PR 単位、1 バッチ=1 カテゴリ。

### Phase 1: ツールのパス解決を抽象化(移動より先)
`tools/scaffold.mjs` を新設: `resolvePackageDir(name)` が `packages/**/package.json` を走査して name→実パスを返す(起動時1回キャッシュ)。
- `smoke.mjs`: `rdc("../packages/<p>/src/…")` の `<p>` 部分を `resolvePackageDir` 経由に一括置換(`sed -E 's#\.\./packages/([a-z-]+)/src#…#'` 相当。~40箇所/カテゴリ)。
- `check-deps.mjs` / `api-surface.mjs` / `gen-module-list.mjs` / `gen-reference.mjs` 系: ディレクトリ走査を `packages/*` → `packages/{*,*/*}` 対応に。
- CI の `PRISMA_SCHEMA=../../apps/...`(packages/db 起点)は移動後 `../../../apps/...` になるため、**リポジトリルート起点の絶対指定**へ変更(`PRISMA_SCHEMA=$GITHUB_WORKSPACE/apps/internal-app/prisma/schema.prisma`)。
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

---

# 新しいパッケージの雛形

**`docs/ops/PACKAGE_CONSOLIDATION.md` を統合したものです（2026-08）。**

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

## README の書き方（2026-08 追加）

**冒頭が `docs/ai/module-list.md` に出ます。** ここが薄いと、
**119 個の中から探せません**。

### 4 つの節で書いてください

1. **1 行の説明** — 何ができるか
2. **これは何のためか** — **無いと何が起きるか**（「便利だから」ではなく）
3. **使う前に知っておくこと** — **知らないと必ず踏む落とし穴**を表で
4. **よく使うもの** — `import` の例

### 書くときの基準

| 書くこと | 書かないこと |
|---|---|
| **無いと何が起きるか** | 「便利です」「簡単に使えます」 |
| **踏みやすい落とし穴** | 全ての関数の一覧（**TSDoc にあります**） |
| **具体的な症状** | 「注意してください」だけ |
| **判断の基準**（迷ったらどうするか） | 実装の詳細 |

**「何をするか」より「何を間違えやすいか」**を書いてください——
**前者は名前から分かりますが、後者は踏むまで分かりません**。

### 済んでいるもの（119 / 119 = すべて）

**利用の多い順**に進めています。

| 回 | パッケージ |
|---|---|
| 1 | `report` `datetime` `utils` `observability` `env` `http` |
| 2 | `accounting` `auth` `workflow` `notify` `csv` `session` |
| 3 | `db` `cms` `chat` `invoice` `mail` `search` |
| 4 | `security` `cache` `upload` `storage` `board` `seo` |
| 5 | `attendance` `payroll` `inventory` `contract` `audit` `ratelimit` |
| 6 | `pdf` `image` `i18n` `flags` `jobs` `cron` |
| 7 | `ai` `rag` `mcp` `integrations` `pii` `crypto` |
| 8 | `zoho` `freee` `line` `slack` `google` `microsoft` |
| 9 | `mobile` `form` `fsm` `guard` `html` `faker` |
| 10 | `core` `currency` `depreciation` `apikey` `config` `commerce` |
| 11 | `address` `booking` `analytics` `access-review` `barcode` `blog` |
| 12 | `dencho` `context` `debug` `fs` `feed` `faq` |
| 13 | `net` `logger` `importer` `quote` `purchase` `phone` |
| 14 | `ocr` `ekyc` `print` `notion` `paypal` `stripe` |
| 15 | `tax` `zengin` `webhook` `saga` `sms` `validation` |
| 16 | `xlsx` `xml` `realtime` `task` `status-page` `sequence` |
| 17 | `theme` `units` `url` `site` `social` `secrets` |
| 18 | `media` `elearning` `cast` `blueprint` `rpa` `device` |
| 19 | `bytes` `color` `json` `web-storage` `push` `testing` `loadtest` `os-notify` `bluetooth` `hid` |

**冒頭の 1 行は 20 文字以上**にしてください（検査で見張っています）——
`module-list` に出るので、**短いと何のパッケージか分かりません**。

**すべて書き終わりました（2026-08）。**

**これで終わりではありません。** 触って**新しい落とし穴を踏んだら、その README に足して**ください——
**踏んだ人にしか書けないこと**があります。

**古くなった記述を見つけたら直してください。** 「そう書いてあるのに違う」が
**一番たちが悪い**——**無いより悪い**です。

### 書くときのやり方

**実装のコメントを先に読んでください。**
`// **〜**` の形で**注意が既に書かれている**ことが多く、
**それを README に持ち上げる**のが一番早くて正確です。

```bash
grep -rhoE '\*\*[^*]{8,44}\*\*' packages/<名前>/src/*.ts | head
```

**想像で書かないでください。** 使ったことのないパッケージについて
「たぶんこう使う」と書くと、**間違ったまま次の人に渡ります**。

## 新しいパッケージを作ったら

**`tools/suggest.mjs` の対応表に足してください**（検査で見張っています）。

**載っていないものは、業務の言葉では探せません**——
**あることを知らずに作り直される**ことになります。

```js
// tools/suggest.mjs
const KEYWORD_MAP = {
  // ...
  あたらしいの: ["業務の言葉", "利用者が使う言い方"],
};
```

**技術の名前ではなく、業務の言葉**を入れてください——
「`normalizePhone`」ではなく「**電話番号**」です。
**探す人は、関数名を知りません**。
