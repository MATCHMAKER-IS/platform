# 基盤プラットフォーム ドキュメント

**読者: 基盤の開発者・利用者。**「何ができるか / どう呼ぶか」を扱います。
アプリ固有の業務内容は扱いません(それは `docs/apps/` へ)。

## API リファレンス(自動生成)

各パッケージの公開 API は TSDoc から自動生成します。

```bash
pnpm docs:platform   # -> docs/platform/api/ に HTML を出力
```

## パッケージ一覧

全 90 パッケージのカテゴリ別索引は [`CATALOG.md`](./CATALOG.md) にあります。
機械可読の要約は [`capabilities.json`](./capabilities.json)、公開 API のスナップショットは
[`api-surface.json`](./api-surface.json) を参照してください。

| カテゴリ | 代表パッケージ |
|---|---|
| 基礎・共通規約 | `core` `logger` `env` `validation` `utils` `datetime` |
| データ・永続化 | `db` `cache` `storage` `csv` `xlsx` `search` |
| 通信・Web連携 | `http` `mail` `sms` `notify` `realtime` `webhook` |
| 外部SaaS連携 | `zoho` `google` `line` `freee` `stripe` `paypal` |
| 認証・セキュリティ | `auth` `session` `guard` `crypto` `secrets` `pii` `apikey` |
| 非同期・ワークフロー | `jobs` `cron` `workflow` `fsm` |
| UI・帳票 | `ui` `form` `report` `pdf` `i18n` |
| 業務ドメイン | `tax` `sequence` `importer` `zengin` `address` `phone` |
| 運用・観測性 | `observability` `flags` |

## 設計原則

1. 基盤はロジックを持たない(機能単位の共通部品のみ)。
2. 有名ライブラリはラッパー経由で使い、公開 API だけをアプリに見せる。
3. 失敗は `@platform/core` の `AppError` / `Result` に統一する。
4. 破壊的変更は Changesets でバージョン管理し、段階的に廃止する。
5. 副作用(fetch・時刻・ストア)は注入し、テスト可能かつ耐障害ラッパーと合成できる形にする。
6. アプリ→基盤の一方向依存のみ許可し、基盤どうしの循環を CI で禁止する。

## 安定性とバージョニング

- 各パッケージは独立してバージョン管理されます(`private` パッケージ・workspace 参照)。
- 公開 API の変更は [`api-surface.json`](./api-surface.json) のスナップショットで検出します。
  意図した変更なら `pnpm check:api --update` で更新し、Changeset を添えます。
- 破壊的変更は即時削除せず、非推奨(deprecated)期間を設けてから廃止します。

## 基盤の使い方(アプリ開発者向け)

1. まず [`CATALOG.md`](./CATALOG.md) で欲しい機能を探す。
2. 見つかれば `@platform/<名前>` を import して使う(各パッケージの README に実例)。
3. 無ければアプリ側(`apps/`)に実装する。**基盤(`packages/`)は編集しない。**
4. 基盤に足りない汎用機能を見つけたら、基盤の変更として別途起票する(アプリ修正とは分ける)。
