# @platform/notion

Notion 連携（データベースの読み書き）。

## これは何のためか

**Notion にある情報を、業務システムから使う**ためのものです。

議事録・ナレッジ・簡単な管理表——
**Notion で作った方が早い**ものが社内にあります。

## 使う前に知っておくこと

| | |
|---|---|
| **返る形が複雑です** | プロパティが**入れ子の入れ子**で返ります——**平たい形に直して**から使ってください |
| **黙って一部だけ処理しない** | ページングがあります。**続きがあるのに気づかず、一部だけ取り込む**のが最も危ないところです |
| **Notion は業務の記録に向きません** | 誰でも編集でき、**履歴を追いにくい**ためです——**監査が要るものは DB へ** |
| **API の上限があります** | 大量に読むと**制限に当たります**——一度に取り切ろうとしないでください |

## よく使うもの

```ts
import { createNotionClient } from "@platform/notion";
import { createNotionClient } from "@platform/notion";

const notion = createNotionClient(process.env.NOTION_TOKEN);
const { pages } = await notion.queryDatabase({ databaseId, pageSize: 20 });
await notion.createPage({
  databaseId,
  properties: { 名前: { type: "title", value: "月次締め" }, 状態: { type: "select", value: "進行中" } },
});
```

## 入れ子を平たくして返します

Notion の応答は `properties.名前.title[0].plain_text` のように深く、そのまま扱うとアプリ側が読みにくくなります。
この層で `properties.名前 === "月次締め"` の形に直します。

## 件数が増えたとき

`queryDatabase` は 1 回分（既定 100 件）しか返しません。**全件が要るなら `queryAll`** を使ってください。

```ts
const pages = await notion.queryAll({ databaseId, filter });   // ページ送りを自動で辿る
```

想定より多いとき（既定 50 ページ = 5000 件超）は**打ち切って例外**にします。
黙って一部だけ処理すると、集計が合わない原因になって気づきにくいためです。

他に `appendParagraphs`（議事録の追記）と `search`（語句で探す）があります。

## 注意する点

| 点 | 内容 |
|---|---|
| **共有を忘れると 404** | 連携したいページ/データベースを、Notion 側で**このインテグレーションに共有**する必要があります。最も多いつまずきなので、404 のメッセージで示唆します |
| **API バージョンを固定** | `NOTION_VERSION` で固定しています。上げるときは影響を確認してください |
| **全部は包んでいません** | 使う操作だけを型付きにしています。他は `notion.request()` で直接叩けます |
