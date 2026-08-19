# @platform/openapi

API の形を機械が読める文書にする（OpenAPI 3.1）。**別のアプリから叩くため**のものです。

## これは何のためか

**別のアプリが、この API を安全に呼べるようにする**ためです。

このリポジトリはアプリを別リポジトリに分けています（ADR 0021）。
つまり **TypeScript の型を直接 import できません**。
`line-console` から `internal-app` の API を叩くとき、
リクエストの形は**呼ぶ側が手で書き写す**ことになります。

**写した形は必ずずれます。** しかも、動かしてみるまで気づきません。

| | 文書が無いと | 文書があると |
|---|---|---|
| 呼ぶ側 | 形を手で写す。ずれても気づかない | **型付きクライアントを生成**できる |
| 提供側 | 壊す変更をしても分からない | **差分で見える** |
| 引き継ぎ | コードを読むしかない | 一覧で分かる |

## 使う前に知っておくこと

| | |
|---|---|
| **文書は自動では正しくなりません** | 載るのは**宣言したものだけ**です。宣言し忘れた API は出ません |
| **入力の検証とは別です** | 文書に書いても検証されません。**検証は各ルートで zod を通してください**（同じスキーマを使えばずれません） |
| **公開してよいかは別問題です** | 社内向けでも、**認証なしで配ると攻撃対象の一覧**になります。認可の内側に置いてください |
| **`z.toJSONSchema` に任せています** | zod v4 の標準機能です。**独自の変換器は書きません**——zod の型は増え続けるので、追随できなくなって**静かに間違った文書を出す**方が危ないためです |
| **変換できないものがあります** | `z.preprocess` を含むと入力側の形に変換できません（zod の既知の問題）。その場合は出力側で代用し、**`x-generation-warnings` に理由を残します** |

## よく使うもの

```ts
import { defineRoute, buildOpenApiDocument } from "@platform/openapi";
```

| | |
|---|---|
| `defineRoute` | API を 1 本宣言する（**ハンドラと同じファイルに置く**） |
| `buildOpenApiDocument` | 宣言を集めて OpenAPI 3.1 の文書にする |

## 使い方

### 1. ルートを宣言する

**ハンドラと同じファイルに置いてください。** 離すと、片方だけ直されます。

```ts
// apps/internal-app/src/app/api/expenses/route.ts
import { defineRoute } from "@platform/openapi";
import { z } from "zod";

const CreateExpense = z.object({
  amount: z.number().int().positive(),
  memo: z.string().max(200).optional(),
});

export const spec = defineRoute({
  method: "post",
  path: "/api/expenses",
  summary: "経費を登録する",
  tags: ["経費"],
  body: CreateExpense,
  response: z.object({ id: z.string() }),
  permission: "expense:write",
});

export async function POST(req: Request): Promise<Response> {
  // **宣言と同じスキーマで検証する。** ここが別物だと文書が嘘になる
  const body = CreateExpense.parse(await req.json());
  // …
}
```

### 2. 文書を組み立てて配る

```ts
// apps/internal-app/src/app/api/openapi.json/route.ts
import { buildOpenApiDocument } from "@platform/openapi";
import { routes } from "../../../server/api-spec";

export async function GET(req: Request): Promise<Response> {
  // **認可の内側に置く**（攻撃対象の一覧を配らない）
  requirePermission(await currentUser(req), "system:manage");
  return Response.json(buildOpenApiDocument({
    title: "internal-app",
    version: "1.0.0",
    routes,
  }));
}
```

### 3. 呼ぶ側でクライアントを生成する

```bash
npx openapi-typescript http://internal-app.local/api/openapi.json -o src/generated/internal-app.d.ts
```

**生成物はコミットしてください。** 相手が落ちているとビルドできない、を避けるためです。

## 決めごと

- **パスは OpenAPI の書き方（`{id}`）** で書きます。Next の `[id]` を渡した場合は自動で直します
- **`auth` の既定は「要る」** です。書き忘れたときに「誰でも叩ける」と文書に書かれる方が危ないためです
- **同じ `method` + `path` を 2 回宣言したらエラー**にします。後から宣言した方が黙って勝つと、文書と実装がずれます
- **失敗の応答（400 / 401 / 403）も必ず載せます**。呼ぶ側は成功だけを見て実装しがちで、落ちたときに握りつぶします

## 説明や例を足したいとき

zod v4 の `.meta()` がそのまま文書に載ります。

```ts
const amount = z.number().int().meta({
  description: "税込の金額（円）。小数は受け付けません",
  examples: [12000],
});
```

## 関連

- [`@platform/validation`](../validation/README.md) — 検証そのもの
- [`@platform/http`](../http/README.md) — エラーの形（`400` などの本文）
- ADR 0021 — アプリを別リポジトリに分けた理由（この文書が要る理由）
