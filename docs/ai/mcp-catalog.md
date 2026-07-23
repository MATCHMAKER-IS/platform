# 基盤カタログ MCP（AI から基盤を検索する）

Claude Code / Claude Desktop などの AI アシスタントから、社内基盤（`@platform/*` 113 パッケージ）を**検索できる**ようにする MCP サーバです。

## 何のためにあるか

このリポジトリの根本方針は「**基盤を再利用し、車輪の再発明をしない**」ことです。しかし 113 パッケージ・3,000 以上の公開 API があると、人も AI も「既にあるのか」を把握しきれません。

この MCP を繋ぐと、AI が実装前に自分で基盤を検索できます。「CSV 出力の関数を書いて」と頼んだとき、AI は `search_platform("csv")` を呼んで `@platform/csv` の `toCsv` を見つけ、**新規に書かずに既存を使う**判断ができます。

## 提供するツール

| ツール | 用途 |
|---|---|
| `search_platform(query, limit?)` | キーワードで基盤機能を探す。日本語可（例: 「メール送信」「権限判定」「csv 出力」） |
| `describe_package(name)` | パッケージ 1 件の README 全文 + 公開 API 一覧 |
| `find_examples(query, limit?)` | **使用例を探す**（demos/ から）。「どう組み合わせるか」の実例が見つかる |
| `explain_rules(topic?)` | 設計ルール（層・依存の向き・検証手順）を返す。**コードを書く前に呼ぶ** |
| `list_platform()` | カテゴリ別のパッケージ一覧（全体像の把握） |
| `search_docs(query, limit?, full?)` | **社内の手順書・規約・設計判断(ADR)を検索**。「どうやって〜するか」「なぜこうなっているか」に答える。見出し単位で引くので、どの資料のどこに書いてあるかまで分かる |

推奨の流れ: `explain_rules`（ルール確認）→ `search_platform`（部品を探す）→ `find_examples`（使い方の実例）→ 実装

**コードと資料は探し先が違います。**

| 知りたいこと | 呼ぶツール |
|---|---|
| 「この機能は基盤にあるか」 | `search_platform` |
| 「どうやって復元するか」「なぜ db push なのか」 | `search_docs` |

`search_docs` は `docs/` 配下と `CLAUDE.md` を **見出し単位（約 860 節）** に分けて索引しています。
検索は BM25（キーワード）で、外部 API も鍵も不要です。オフラインの手元でもそのまま動きます。
ベクトル検索へ移す場合は `@platform/rag` の `VectorIndex` に差し替えられる形にしてあります。

すべて**読み取り専用**です。リポジトリのファイルを変更することはありません。

## 起動

```bash
pnpm mcp:catalog
```

## Claude Desktop への接続

設定ファイル（macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`）にマージしてください。

```json
{
  "mcpServers": {
    "platform-catalog": {
      "command": "node",
      "args": ["--experimental-strip-types", "/絶対パス/platform/tools/mcp-catalog.mts"]
    }
  }
}
```

## Claude Code への接続

```bash
claude mcp add platform-catalog -- node --experimental-strip-types ./tools/mcp-catalog.mts
```

## データ源と更新

カタログは以下の生成物から起動時に一度だけ読みます。

- `docs/platform/api-surface.json` … 全 export の一覧（漏れがない）
- `docs/platform/api-reference.json` … JSDoc 要約付きの API（説明がある）
- `docs/ai/module-list.md` … カテゴリ分類
- `packages/<name>/README.md` … 各パッケージの説明

**基盤を変更したら `pnpm gen:all` で生成物を更新し、MCP サーバを再起動**してください（起動時読み込みのため）。

## 使い方の例

AI との対話で、次のように働きます。

> **人**: 請求書を PDF にする機能を作って
>
> **AI**: （`search_platform("請求書 PDF")` を呼ぶ）→ `@platform/invoice` の `renderInvoiceHtml` と `@platform/pdf` の `createPdf` が見つかった。新規に書かず、これらを組み合わせる。

これにより、**基盤にあるのに気づかず似た関数を作る**という事故を防げます。
