"use client";
/** MCP のデモ: ツール定義・JSON-RPC の解析・isError の流儀・スコープ認可。 */
import * as React from "react";
import { parseJsonRpc, textResult, jsonResult, errorResult, type McpToolDef, type McpToolResult } from "@platform/mcp";

/** 在庫(モック)。 */
const STOCK: Record<string, number> = { "A-1001": 12, "A-1002": 0, "B-2001": 340 };

const TOOLS: McpToolDef[] = [
  {
    name: "inventory_get",
    description: "SKU から在庫数を引く",
    inputSchema: { type: "object", properties: { sku: { type: "string", description: "商品コード" } }, required: ["sku"] },
    handler: (args) => {
      const sku = args["sku"];
      if (typeof sku !== "string") return errorResult("sku は文字列で指定してください");
      const qty = STOCK[sku];
      if (qty === undefined) return errorResult(`未登録の SKU です: ${sku}`);
      return jsonResult({ sku, qty, inStock: qty > 0 });
    },
  },
  {
    name: "inventory_list",
    description: "在庫を一覧する",
    inputSchema: { type: "object", properties: {} },
    handler: () => jsonResult(Object.entries(STOCK).map(([sku, qty]) => ({ sku, qty }))),
  },
  {
    name: "inventory_adjust",
    description: "在庫を増減する（書き込み）",
    inputSchema: {
      type: "object",
      properties: { sku: { type: "string" }, delta: { type: "number" } },
      required: ["sku", "delta"],
    },
    scopes: ["inventory:write"],
    destructive: true,
    handler: (args) => {
      const sku = args["sku"];
      const delta = args["delta"];
      if (typeof sku !== "string" || typeof delta !== "number") return errorResult("sku(文字列) と delta(数値) が必要です");
      const cur = STOCK[sku];
      if (cur === undefined) return errorResult(`未登録の SKU です: ${sku}`);
      STOCK[sku] = cur + delta;
      return textResult(`${sku} を ${delta > 0 ? "+" : ""}${delta} しました（現在 ${STOCK[sku]}）`);
    },
  },
  { name: "ping", description: "疎通確認", inputSchema: { type: "object", properties: {} }, handler: () => textResult("pong") },
];

/** 付与するスコープ(実運用は Bearer トークンから取り出す)。 */
const SCOPE_SETS: Record<string, string[]> = {
  "読み取りのみ": [],
  "書き込み可": ["inventory:write"],
};

const SAMPLES = [
  '{"jsonrpc":"2.0","id":1,"method":"tools/list"}',
  '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"inventory_get","arguments":{"sku":"A-1001"}}}',
  '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"inventory_get","arguments":{"sku":"ZZZ"}}}',
  '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"inventory_adjust","arguments":{"sku":"A-1002","delta":5}}}',
  '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"unknown_tool","arguments":{}}}',
  "これは JSON ではありません",
];

const box: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  background: "var(--color-surface)",
  padding: 16,
  marginBottom: 16,
};

/** 1 行の JSON-RPC を処理する(サーバ実装の要点だけを再現)。 */
async function handle(line: string, scopes: string[]): Promise<string> {
  const parsed = parseJsonRpc(line);
  // parseJsonRpc は Result 型。失敗時は **整形済みの JsonRpcResponse** をくれるので、
  // アプリ側で -32700 を組み立てる必要がない(手で書くとコード番号を間違える)。
  if (!parsed.ok) return JSON.stringify(parsed.error, null, 2);

  const { id = null, method, params } = parsed.value;

  if (method === "tools/list") {
    return JSON.stringify(
      { jsonrpc: "2.0", id, result: { tools: TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })) } },
      null,
      2,
    );
  }

  if (method === "tools/call") {
    const p = (params ?? {}) as { name?: unknown; arguments?: unknown };
    const name = typeof p.name === "string" ? p.name : "";
    const tool = TOOLS.find((t) => t.name === name);
    // 未知のツールは JSON-RPC のエラー(プロトコル違反)
    if (!tool) return JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32602, message: `Unknown tool: ${name}` } }, null, 2);

    // スコープ不足は isError で返す(AI が理解して次の手を考えられるように)
    const need = tool.scopes ?? [];
    const lacking = need.filter((s) => !scopes.includes(s));
    if (lacking.length > 0) {
      const denied: McpToolResult = errorResult(`権限が足りません（必要: ${lacking.join(", ")}）`);
      return JSON.stringify({ jsonrpc: "2.0", id, result: denied }, null, 2);
    }

    const args = (p.arguments ?? {}) as Record<string, unknown>;
    const result = await tool.handler(args);
    return JSON.stringify({ jsonrpc: "2.0", id, result }, null, 2);
  }

  return JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${String(method)}` } }, null, 2);
}

export default function Page() {
  const [line, setLine] = React.useState(SAMPLES[1] ?? "");
  const [scopeSet, setScopeSet] = React.useState("読み取りのみ");
  const [out, setOut] = React.useState("");

  async function run() {
    setOut(await handle(line, SCOPE_SETS[scopeSet] ?? []));
  }

  return (
    <main style={{ maxWidth: 860, margin: "2.5rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 4 }}>MCP サーバ</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.8, marginBottom: 20 }}>
        社内システムを <strong>AI から呼べる道具として公開する</strong>ための仕組みです。
        Claude Desktop や Claude Code が、この JSON-RPC を喋って在庫照会などを実行します。
        下の入力欄で、実際のリクエストを投げて応答を確かめられます。
      </p>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>公開しているツール</h2>
        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--color-muted)" }}>
              <th style={{ padding: 4 }}>name</th>
              <th style={{ padding: 4 }}>説明</th>
              <th style={{ padding: 4 }}>必要スコープ</th>
            </tr>
          </thead>
          <tbody>
            {TOOLS.map((t) => (
              <tr key={t.name} style={{ borderTop: "1px solid var(--color-border)" }}>
                <td style={{ padding: 4, fontFamily: "monospace" }}>
                  {t.name}
                  {t.destructive === true && <span style={{ color: "var(--color-danger)", marginLeft: 6 }}>破壊的</span>}
                </td>
                <td style={{ padding: 4 }}>{t.description}</td>
                <td style={{ padding: 4, color: "var(--color-muted)" }}>{(t.scopes ?? []).join(", ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={box}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <select
            value={scopeSet}
            onChange={(e) => setScopeSet(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: "var(--radius)", border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-fg)" }}
          >
            {Object.keys(SCOPE_SETS).map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <button
            onClick={run}
            style={{ padding: "6px 16px", borderRadius: "var(--radius)", border: "none", background: "var(--color-primary)", color: "var(--color-primary-fg)", cursor: "pointer" }}
          >
            送信
          </button>
        </div>

        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
          {SAMPLES.map((s, i) => (
            <button
              key={i}
              onClick={() => setLine(s)}
              style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-muted)", cursor: "pointer" }}
            >
              例{i + 1}
            </button>
          ))}
        </div>

        <textarea
          value={line}
          onChange={(e) => setLine(e.target.value)}
          rows={4}
          style={{ width: "100%", padding: 10, borderRadius: "var(--radius)", border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-fg)", fontFamily: "monospace", fontSize: 12 }}
        />
        <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, background: "var(--color-bg)", padding: 12, borderRadius: "var(--radius)", marginTop: 12, marginBottom: 0 }}>
          {out === "" ? "（送信するとここに応答が出ます）" : out}
        </pre>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>MCP の流儀</h2>
        <ul style={{ fontSize: 13, lineHeight: 1.9, margin: 0, paddingLeft: "1.2em", color: "var(--color-muted)" }}>
          <li>
            <strong>ツールの実行エラーは JSON-RPC のエラーにしない。</strong>
            <code>isError</code> で返します（例3・例4）。プロトコルのエラーにすると、AI には何が起きたか分からず次の手を考えられません。
          </li>
          <li>
            <strong>未知のツールやパース不能は JSON-RPC のエラー</strong>（例5・例6）。こちらは本当のプロトコル違反です。
          </li>
          <li>
            <strong>書き込み系にはスコープを付ける。</strong>「読み取りのみ」で例4 を送ると拒否されます。
          </li>
        </ul>
      </div>
    </main>
  );
}
