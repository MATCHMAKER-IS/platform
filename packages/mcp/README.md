# @platform/mcp

MCP サーバ（AI に道具を渡す仕組み）。

## これは何のためか

**AI に社内のデータを引かせる**ためのものです。
Claude や他の AI クライアントから、**基盤の機能を道具として呼べます**。

## 使う前に知っておくこと

| | |
|---|---|
| **道具の説明は AI が読みます** | 「経費を検索」より「**指定した月の経費の一覧と合計を返す**」——**何が返るか**まで書いてください。分かりにくいと**使ってくれません** |
| **引数は信用できません** | AI は**存在しない ID や範囲外の日付**を渡してきます。`validateToolArguments` で**渡す前に検証**してください |
| **危ないことをさせない** | 削除・送金・送信を道具にすると、**AI の勘違いで実行されます**。**読み取りだけ**にするか、**人の確認を挟んで**ください |
| **長く走る道具は中止できるように** | 止める手段が無いと、**終わるまで待つしかありません**（`createCancellationRegistry`） |

## よく使うもの

```ts
import { handleMcpMessage, validateToolArguments, jsonResult } from "@platform/mcp";
import { serveStdio, textResult, type McpToolDef } from "@platform/mcp";
const tools: McpToolDef[] = [{
  name: "hello", description: "挨拶する",
  inputSchema: { type: "object", properties: { name: { type: "string" } } },
  handler: (args) => textResult(`こんにちは、${args.name}さん`),
}];
await serveStdio({ name: "my-server", version: "1.0.0", tools });
```

実利用例: `apps/internal-app/mcp/`(請求・在庫・監査・Zoho CRM の8ツール)。ツールの足し方は `docs/ai/patterns.md` の「6. MCP ツールの足し方」を参照。stdout はプロトコル専用なので、ログは stderr へ。

## MCP over HTTP(リモート接続)

stdio に加え、**Streamable HTTP(stateless)**でも公開できます(社内 yojitsu の設計を公式 SDK 非依存で一般化)。Next.js Route Handler や Amplify(serverless)にそのまま載ります。

- `handleHttpMcp(request, options)`: Web 標準 `Request`→`Response`。POST のみ、通知は 202、認証失敗は 401 + WWW-Authenticate(RFC 9728)
- `extractBearerToken(header)`: Authorization ヘッダから Bearer を抽出
- 認可はトークン検証関数を注入(トークンの保存方式は基盤で規定しない)。`authorizeTool` と組み合わせてスコープ制御

```ts
// app/api/mcp/route.ts
import { handleHttpMcp } from "@platform/mcp";
export const POST = (req: Request) => handleHttpMcp(req, {
  server: { name: "app", version: "1", tools, authorizeTool },
  authenticate: async (token) => token ? { subject: await verifyToken(token) } : null,
  resourceMetadataUrl: `${base}/.well-known/oauth-protected-resource`,
});
```
