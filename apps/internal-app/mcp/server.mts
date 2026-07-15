/**
 * internal-app の MCP サーバ(stdio)。Claude Desktop / Claude Code などの MCP クライアントから
 * 社内データ(請求・取引先・在庫・監査・売上CSV)と Zoho CRM をツールとして操作できるようにする。
 *
 * 起動:   pnpm --filter internal-app mcp        ※要 pnpm install(オフライン開発環境では実行不可)
 * 接続:   mcp/claude_desktop_config.example.json を参照(Claude Desktop の設定へマージ)
 * 環境:   internal-app と同じ(.env)。Zoho ツールは ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET / ZOHO_REFRESH_TOKEN(+ZOHO_DC)設定時のみ有効。
 * 注意:   stdout は MCP プロトコル専用。ログは必ず stderr(console.error)へ。
 */
import { serveStdio, type McpCallContext } from "@platform/mcp";
import { createZohoCrmClient, refreshAccessToken } from "@platform/zoho";
import { buildMcpTools, buildMcpResources, buildMcpPrompts, type McpToolDeps } from "../src/server/mcp-tools.js";
import { invoiceStore, partnerStore, inventoryStore, auditLog, auditActions } from "../src/server/platform-services.js";
import { zohoClientConfigFromEnv, createResilientZohoFetch } from "../src/server/zoho-client.js";

async function buildZoho(): Promise<McpToolDeps["zoho"]> {
  if (!process.env.ZOHO_REFRESH_TOKEN) {
    console.error("[mcp] ZOHO_REFRESH_TOKEN 未設定のため zoho_* ツールは無効(設定ガイド応答)で起動します");
    return undefined;
  }
  const cfg = zohoClientConfigFromEnv();
  const fetchImpl = createResilientZohoFetch(cfg);
  const token = await refreshAccessToken({ ...cfg, fetchImpl });
  if (!token.ok) {
    console.error(`[mcp] Zoho トークン更新に失敗: ${token.error}(zoho_* ツールは無効のまま起動します)`);
    return undefined;
  }
  const crm = createZohoCrmClient({ apiDomain: token.value.apiDomain, accessToken: token.value.accessToken, fetchImpl });
  console.error("[mcp] Zoho CRM ツールを有効化しました");
  return {
    searchRecords: (module, query) => crm.searchRecords(module, query),
    getRecord: (module, id) => crm.getRecord(module, id),
  };
}

const zoho = await buildZoho();

// 書き込みツールは MCP_ENABLE_WRITES=1 のときだけ有効化(既定は読み取り専用)
const enableWrites = process.env.MCP_ENABLE_WRITES === "1";
const writes: McpToolDeps["writes"] = enableWrites
  ? {
      recordPayment: async (number, amount) => {
        const v = await invoiceStore.recordPayment(number, amount);
        return v ? { ok: true, balance: v.balance } : { ok: false, error: `請求 ${number} が見つかりません` };
      },
      cancelInvoice: async (number) => {
        const v = await invoiceStore.cancel(number);
        return v ? { ok: true } : { ok: false, error: `請求 ${number} が見つかりません` };
      },
      audit: async (action, target, detail) => {
        await auditActions.record("mcp", action, target, { after: detail });
      },
      actor: "mcp",
    }
  : undefined;
if (enableWrites) console.error("[mcp] 書き込みツールを有効化(MCP_ENABLE_WRITES=1)");

const deps: McpToolDeps = { invoiceStore, partnerStore, inventoryStore, auditLog, ...(zoho ? { zoho } : {}), ...(writes ? { writes } : {}) };
const tools = buildMcpTools(deps);
const resources = buildMcpResources({ invoiceStore, inventoryStore });
const prompts = buildMcpPrompts();

// トークン認可: MCP_API_KEY_SCOPES(例 "invoice:read,invoice:write")で許可スコープを与える。
// stdio は「起動できる人=使える人」なので、書き込みの最終ゲートは MCP_ENABLE_WRITES。scope はさらに絞る用途。
const grantedScopes = (process.env.MCP_API_KEY_SCOPES ?? "invoice:read,invoice:write").split(",").map((x) => x.trim()).filter(Boolean);
const ctx: McpCallContext = { subject: { id: "stdio-local", scopes: grantedScopes } };
const authorizeTool = (tool: (typeof tools)[number]): true | string => {
  if (!tool.scopes) return true;
  return tool.scopes.every((need) => grantedScopes.includes(need)) || `スコープ不足: ${tool.scopes.join(", ")} が必要です`;
};

console.error(`[mcp] internal-app MCP サーバ起動(ツール ${tools.length} / リソース ${resources.length} / プロンプト ${prompts.length})`);
await serveStdio({ name: "internal-app", version: "0.1.0", tools, resources, prompts, authorizeTool }, undefined, ctx);
