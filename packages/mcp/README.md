# @platform/mcp

**MCP(Model Context Protocol)サーバの最小実装**。JSON-RPC 2.0 上で `initialize` / `tools/list` / `tools/call` を提供し、Claude Desktop / Claude Code などの MCP クライアントから社内基盤の機能を「ツール」として呼び出せるようにします。

- `handleMcpMessage(options, req)` … プロトコル処理の**純関数**(トランスポート無しでテスト可能)
- `serveStdio(options, io?)` … 改行区切り JSON の stdio サーバ(io 注入でテスト可能)
- `McpToolDef` … ツール定義 `{ name, description, inputSchema(JSON Schema), handler }`
- `textResult` / `jsonResult` / `errorResult` … 結果ヘルパ(実行エラーは JSON-RPC エラーではなく `isError` で返すのが MCP 流儀)
- バージョン交渉: 2025-06-18 / 2025-03-26 / 2024-11-05 に対応(未対応要求は最新へ)

```ts
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
