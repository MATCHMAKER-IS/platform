# はじめての人へ

**上から順に読んでください。** 2026-08 に 6 つに散っていた入門資料を
4 つに束ねました（内容は減らしていません）。

| | 資料 | 何が書いてあるか | 目安 |
|---|---|---|---|
| 1 | [01-setup.md](./01-setup.md) | **環境を作る**（OS 別の手順・つまずいたとき） | 30〜60 分 |
| 2 | [02-first-hour.md](./02-first-hour.md) | **最初の 1 時間**（触って動かす） | 60 分 |
| 3 | [03-development.md](./03-development.md) | **開発の始め方**（基盤とアプリの分け方・約束事） | 30 分 |
| 4 | [04-task.md](./04-task.md) | **練習課題**（1 つ機能を足してみる） | 半日 |
| 5 | [05-verify.md](./05-verify.md) | **壊れていないか確かめる**（段階的な検証手順） | 随時 |

## 引き継いだ人が最初にやること

**この基盤を受け取ったら、上の 1〜5 の前に**次を済ませてください。
**書き換えないと動かないもの**が残っています。

| やること | 場所 | 済まないと |
|---|---|---|
| **`CODEOWNERS` の名前を書き換える** | `.github/CODEOWNERS` | **レビューが誰にも回りません**（`@yamada` `@your-org` はプレースホルダです） |
| **本番の環境変数を用意する** | `apps/internal-app/.env.example` を写す | 起動時に止まります（`SESSION_SECRET` など） |
| **GitHub Secrets を設定する** | リポジトリの設定 | 契約テスト（外部 SaaS の応答確認）が動きません |

詳しくは `../ops/GITHUB_ACTIONS.md` の「CODEOWNERS の置換」へ。

**引き継ぎで一番大事なのは `../ops/HANDOVER.md` です。**
「なぜこのコードがこうなっているか」が全部書いてあります——
**直す前に、まずそこを検索してください**。同じ判断を繰り返さずに済みます。

## 必要になったときだけ

| 資料 | いつ読むか |
|---|---|
| [apply-zip.md](./apply-zip.md) | **ZIP で受け取った変更を反映する**とき（Windows / PowerShell） |
| [tailwind.md](./tailwind.md) | **画面のスタイルが当たらない**とき（Tailwind の設定） |

## 迷ったとき

| 知りたいこと | 見る場所 |
|---|---|
| 部品を探す | `pnpm advisor find "<やりたいこと>"` |
| 基盤に何があるか | `../ai/module-list.md`（自動生成・119 件） |
| **どの画面・API があるか** | `../platform/appmap/internal-app.md`（**自動生成・321 件**） |
| **DB のテーブル** | `../platform/erd/internal-app.md`（自動生成） |
| コマンド | `docs/ops/COMMANDS.md` |
| 検査が落ちた | `docs/ops/CHECKS.md` |
| 障害が起きた | `docs/ops/INCIDENT_RESPONSE.md` |

## 環境が壊れたら

`pnpm doctor` で診断してください。**直し方まで出ます。**
それでも動かないときは `01-setup.md` の「つまずいたとき」へ。
