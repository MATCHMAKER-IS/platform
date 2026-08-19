/**
 * MCP(Model Context Protocol)サーバの最小実装。JSON-RPC 2.0 上で initialize / tools(list, call)を提供し、
 * Claude Desktop / Claude Code などの MCP クライアントから社内基盤の機能を「ツール」として呼び出せるようにする。
 * プロトコル処理は純関数(handleMcpMessage)なので、トランスポート無しでテストできる。stdio 用の薄いサーバも同梱。
 * @packageDocumentation
 */

/** JSON-RPC 2.0 リクエスト/通知。 */
export interface JsonRpcRequest {
  jsonrpc: "2.0";
  /** 無ければ通知(応答しない)。 */
  id?: number | string | null;
  method: string;
  params?: unknown;
}

/** JSON-RPC 2.0 レスポンス。 */
export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number | string | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

/** ツール実行結果(MCP の CallToolResult)。 */
export interface McpToolResult {
  content: { type: "text"; text: string }[];
  isError?: boolean;
}

/** ツール定義。inputSchema は JSON Schema(object)。 */
export interface McpToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<McpToolResult> | McpToolResult;
  /** このツールに必要なスコープ(authorizeTool の判断材料。書き込み系に付ける)。 */
  scopes?: string[];
  /** 破壊的変更を伴うか(クライアント表示用の MCP annotations)。 */
  destructive?: boolean;
}

/** リソース定義(読み取り専用の参照データ)。 */
export interface McpResourceDef {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  /** 内容を返す。 */
  read: () => Promise<string> | string;
}

/** プロンプト定義(定型プロンプトのテンプレート)。 */
export interface McpPromptDef {
  name: string;
  description?: string;
  arguments?: { name: string; description?: string; required?: boolean }[];
  /** 引数を受けてメッセージ列を返す。 */
  build: (args: Record<string, string>) => { role: "user" | "assistant"; content: string }[];
}

/** ツール呼び出しの認可コンテキスト(トランスポート層が埋める)。 */
export interface McpCallContext {
  /** 認証済みの主体(API キー認証などの結果)。未認証は undefined。 */
  subject?: { id: string; scopes: string[] };
}

/** サーバ情報とツール/リソース/プロンプト群。 */
export interface McpServerOptions {
  name: string;
  version: string;
  tools: McpToolDef[];
  resources?: McpResourceDef[];
  prompts?: McpPromptDef[];
  /**
   * ツール実行前の認可フック。false / エラーメッセージを返すと isError で拒否。
   * 認可情報は McpCallContext(第2引数)経由。省略時は常に許可(ローカル stdio 想定)。
   */
  authorizeTool?: (tool: McpToolDef, ctx: McpCallContext) => true | string;
}

/** 対応プロトコルバージョン(新しい順)。 */
export const SUPPORTED_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"] as const;

/**
 * テキスト 1 件の成功結果を作る。
 *
 * @param text 返すテキスト
 * @returns MCP のツール結果
 */
export function textResult(text: string): McpToolResult {
  return { content: [{ type: "text", text }] };
}

/**
 * エラー結果を作る。
 *
 * **ツールの実行エラーは JSON-RPC のエラーにしない**のが MCP の流儀。
 * `isError` で返すことで、AI が「エラーが起きた」と理解して次の手を考えられる
 * (プロトコルのエラーにすると、AI には何が起きたか分からない)。
 *
 * @param message エラーメッセージ(**AI が読んで理解できる文言に**)
 * @returns MCP のツール結果(isError)
 */
export function errorResult(message: string): McpToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

/**
 * JSON をツール結果にする。
 *
 * **整形して返す**(AI も人も読むため)。
 *
 * @param value 返す値
 * @returns MCP のツール結果
 */
export function jsonResult(value: unknown): McpToolResult {
  return textResult(JSON.stringify(value, null, 2));
}

const rpcError = (id: number | string | null, code: number, message: string): JsonRpcResponse => ({ jsonrpc: "2.0", id, error: { code, message } });
const rpcResult = (id: number | string | null, result: unknown): JsonRpcResponse => ({ jsonrpc: "2.0", id, result });

/**
 * 1 行の JSON をリクエストとして解析する。
 *
 * **壊れていれば -32700(Parse error)を返す**(JSON-RPC の規定)。
 * 例外を投げるとサーバが落ちるので、レスポンスとして返す。
 *
 * @param line 1 行の JSON
 * @returns リクエスト、またはエラーレスポンス
 */
export function parseJsonRpc(line: string): { ok: true; value: JsonRpcRequest } | { ok: false; error: JsonRpcResponse } {
  try {
    const obj = JSON.parse(line) as JsonRpcRequest;
    if (obj.jsonrpc !== "2.0" || typeof obj.method !== "string") return { ok: false, error: rpcError(obj.id ?? null, -32600, "不正なリクエストです") };
    return { ok: true, value: obj };
  } catch {
    return { ok: false, error: rpcError(null, -32700, "JSON を解析できません") };
  }
}

/**
 * **走っている処理を止められるようにする器。**
 *
 * 【なぜ要るか】
 * MCP のツールは**長く走ることがあります**（帳票の生成、一括の取り込み）。
 * 利用者が「やっぱりやめる」と言ったとき、**止める手段が無いと
 * 終わるまで待つしかありません**——その間も**AI の課金は進みます**。
 *
 * MCP は `notifications/cancelled` で中止を伝えますが、
 * **受け取っただけでは止まりません**——
 * **走っている処理に伝える仕組み**がここです。
 *
 * 【使い方】
 * ツールの `handler` に `signal` を渡し、**時間のかかる処理の合間に
 * `signal.aborted` を見て**ください。見ないと止まりません。
 *
 * ```ts
 * for (const row of rows) {
 *   if (signal.aborted) throw new Error("中止されました");
 *   await process(row);
 * }
 * ```
 *
 * **外部への呼び出しには `signal` をそのまま渡せます**（`fetch` が対応しています）。
 */
export interface McpCancellation {
  /** 処理に渡す合図。**`aborted` を見ないと止まりません**。 */
  signal: AbortSignal;
  /** 中止を伝える。 */
  cancel(): void;
  /** 終わったので後片付けする。**呼ばないと溜まり続けます**。 */
  done(): void;
}

/**
 * **要求 ID ごとに中止の合図を管理する。**
 *
 * 【必ず `done()` を呼んでください】
 * 呼ばないと**終わった処理の合図が残り続け**、
 * **長く動かすほどメモリを食います**——`finally` で呼ぶのが確実です。
 *
 * @returns 中止の管理をする器
 */
export function createCancellationRegistry(): {
  /** 新しい処理を登録する。 */
  start(requestId: string | number): McpCancellation;
  /** 中止を伝える（`notifications/cancelled` を受けたとき）。 */
  cancel(requestId: string | number): boolean;
  /** いま走っている数（**溜まっていないかの確認用**）。 */
  size(): number;
} {
  const running = new Map<string, AbortController>();
  const key = (id: string | number) => String(id);

  return {
    start(requestId) {
      const controller = new AbortController();
      running.set(key(requestId), controller);
      return {
        signal: controller.signal,
        cancel: () => controller.abort(),
        // **`finally` で呼んでください。** 呼ばないと溜まり続けます
        done: () => { running.delete(key(requestId)); },
      };
    },

    cancel(requestId) {
      const controller = running.get(key(requestId));
      // **見つからなくても失敗ではありません。**
      // すでに終わっている処理への中止は**よくあること**です
      // ——利用者が押した瞬間に終わった、という順序で起きます。
      if (controller === undefined) return false;
      controller.abort();
      running.delete(key(requestId));
      return true;
    },

    size: () => running.size,
  };
}

/**
 * ツールの引数が **`inputSchema` に合っているか**を確かめる。
 *
 * 【なぜ要るか】
 * **引数を渡してくるのは AI です。** 型を宣言しても、
 * **AI が違うものを渡してこない保証はありません**——
 * 数値のつもりが文字列、必須のはずが欠けている、といったことが実際に起きます。
 *
 * **検証せずに `handler` へ渡すと、その場で落ちるか、
 * もっと悪いことに「それらしい間違った結果」を返します**——
 * 金額に `"1000円"` が渡って `NaN` になり、**0 円として登録される**のが最悪の形です。
 *
 * 【どこまで見るか】
 * **JSON Schema の全部は見ません**（`required` と `type` だけ）。
 * 完全な検証が要るなら **`handler` の中で `zod`** を使ってください
 * ——ここは**明らかな取り違えを門前で弾く**ためのものです。
 *
 * @param schema ツールが宣言した `inputSchema`
 * @param args AI が渡してきた引数
 * @returns 問題があればその説明。無ければ `undefined`
 */
export function validateToolArguments(
  schema: Record<string, unknown> | undefined,
  args: Record<string, unknown>,
): string | undefined {
  if (schema === undefined) return undefined;

  const required = Array.isArray(schema["required"]) ? schema["required"] : [];
  for (const key of required) {
    if (typeof key !== "string") continue;
    // **`undefined` も `null` も「無い」と見なします。**
    // AI は「値が無い」を `null` で渡してくることがあります。
    if (args[key] === undefined || args[key] === null) {
      return `必須の引数がありません: ${key}`;
    }
  }

  const properties = schema["properties"];
  if (typeof properties !== "object" || properties === null) return undefined;

  for (const [key, value] of Object.entries(args)) {
    const prop = (properties as Record<string, unknown>)[key];
    if (typeof prop !== "object" || prop === null) continue;
    const expected = (prop as Record<string, unknown>)["type"];
    if (typeof expected !== "string") continue;

    const actual = Array.isArray(value) ? "array"
      : value === null ? "null"
      : typeof value;
    // **`integer` は `number` として見ます**（JSON には整数型がありません）
    const isOk = expected === "integer"
      ? actual === "number" && Number.isInteger(value)
      : expected === actual;
    if (!isOk) {
      return `引数の型が違います: ${key} は ${expected} ですが ${actual} が渡されました`;
    }
  }
  return undefined;
}

/**
 * MCP メッセージを処理する(純関数)。通知(id 無し)は null を返し、応答しない。
 * 対応メソッド: initialize / notifications/initialized / ping / tools/list / tools/call
 *
 * @param options サーバの設定（公開するツールの一覧など）
 * @param req MCP のリクエスト
 * @param ctx 呼び出しの文脈（誰が呼んだか。**権限の判定に使う**）
 * @returns レスポンス。**通知(id 無し)には null**(JSON-RPC の規定)
 */
export async function handleMcpMessage(options: McpServerOptions, req: JsonRpcRequest, ctx: McpCallContext = {}): Promise<JsonRpcResponse | null> {
  const isNotification = req.id === undefined;
  const id = req.id ?? null;

  if (req.method === "initialize") {
    const params = (req.params ?? {}) as { protocolVersion?: string };
    const requested = params.protocolVersion;
    const protocolVersion = requested && (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(requested) ? requested : SUPPORTED_PROTOCOL_VERSIONS[0];
    const capabilities: Record<string, unknown> = { tools: {} };
    if (options.resources && options.resources.length > 0) capabilities.resources = {};
    if (options.prompts && options.prompts.length > 0) capabilities.prompts = {};
    return rpcResult(id, { protocolVersion, capabilities, serverInfo: { name: options.name, version: options.version } });
  }
  if (req.method === "notifications/initialized") return null;
  if (req.method === "ping") return isNotification ? null : rpcResult(id, {});
  if (req.method === "tools/list") {
    return rpcResult(id, {
      tools: options.tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
        ...(t.destructive !== undefined ? { annotations: { destructiveHint: t.destructive } } : {}),
      })),
    });
  }
  if (req.method === "tools/call") {
    const params = (req.params ?? {}) as { name?: string; arguments?: Record<string, unknown> };
    const tool = options.tools.find((t) => t.name === params.name);
    if (!tool) return rpcError(id, -32602, `未知のツールです: ${String(params.name)}`);
    if (options.authorizeTool) {
      const verdict = options.authorizeTool(tool, ctx);
      if (verdict !== true) return rpcResult(id, errorResult(typeof verdict === "string" ? verdict : "このツールを実行する権限がありません"));
    }
    try {
      // **AI が渡す引数は信用できません。**
      // 宣言した `inputSchema` に合っているかを、**渡す前に**確かめます
      // ——検証せずに渡すと、その場で落ちるか、
      // もっと悪いことに**「それらしい間違った結果」**を返します
      // （金額に `"1000円"` が渡って `NaN` になり、**0 円として登録される**）。
      const invalid = validateToolArguments(tool.inputSchema, params.arguments ?? {});
      if (invalid !== undefined) return rpcResult(id, errorResult(invalid));
      const result = await tool.handler(params.arguments ?? {});
      return rpcResult(id, result);
    } catch (e) {
      return rpcResult(id, errorResult(e instanceof Error ? e.message : String(e)));
    }
  }
  if (req.method === "resources/list") {
    return rpcResult(id, { resources: (options.resources ?? []).map((r) => ({ uri: r.uri, name: r.name, ...(r.description ? { description: r.description } : {}), ...(r.mimeType ? { mimeType: r.mimeType } : {}) })) });
  }
  if (req.method === "resources/read") {
    const params = (req.params ?? {}) as { uri?: string };
    const resource = (options.resources ?? []).find((r) => r.uri === params.uri);
    if (!resource) return rpcError(id, -32602, `未知のリソースです: ${String(params.uri)}`);
    try {
      const text = await resource.read();
      return rpcResult(id, { contents: [{ uri: resource.uri, mimeType: resource.mimeType ?? "text/plain", text }] });
    } catch (e) {
      return rpcError(id, -32603, e instanceof Error ? e.message : String(e));
    }
  }
  if (req.method === "prompts/list") {
    return rpcResult(id, { prompts: (options.prompts ?? []).map((p) => ({ name: p.name, ...(p.description ? { description: p.description } : {}), ...(p.arguments ? { arguments: p.arguments } : {}) })) });
  }
  if (req.method === "prompts/get") {
    const params = (req.params ?? {}) as { name?: string; arguments?: Record<string, string> };
    const prompt = (options.prompts ?? []).find((p) => p.name === params.name);
    if (!prompt) return rpcError(id, -32602, `未知のプロンプトです: ${String(params.name)}`);
    const messages = prompt.build(params.arguments ?? {}).map((m) => ({ role: m.role, content: { type: "text", text: m.content } }));
    return rpcResult(id, { ...(prompt.description ? { description: prompt.description } : {}), messages });
  }
  return isNotification ? null : rpcError(id, -32601, `未対応のメソッドです: ${req.method}`);
}

/** stdio の入出力(テストでは PassThrough を注入)。 */
export interface StdioLike {
  input: NodeJS.ReadableStream;
  output: { write(chunk: string): unknown };
}

/**
 * 改行区切り JSON の stdio サーバを起動する。入力ストリームが閉じるまで動く。
 * 本番: `serveStdio(options)`(process.stdin/stdout)。ログは stderr へ(標準出力はプロトコル専用)。
 * @param options サーバの設定（公開するツールの一覧など）
 * @param io 入出力(**テストで差し替えられる**)
 * @param ctx 呼び出しの文脈（誰が呼んだか。**権限の判定に使う**）
 */
export async function serveStdio(options: McpServerOptions, io?: StdioLike, ctx: McpCallContext = {}): Promise<void> {
  const input = io?.input ?? process.stdin;
  const output = io?.output ?? process.stdout;
  let buffer = "";
  for await (const chunk of input) {
    buffer += String(chunk);
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      const parsed = parseJsonRpc(line);
      const res = parsed.ok ? await handleMcpMessage(options, parsed.value, ctx) : parsed.error;
      if (res) output.write(JSON.stringify(res) + "\n");
    }
  }
}

// ─────────────────────── HTTP トランスポート(Streamable HTTP / stateless) ───────────────────────
// 出典: 社内 yojitsu の MCP over HTTP(Streamable HTTP・stateless・Bearer 認証・RFC 9728)の設計を、
// 公式 SDK 非依存の薄いアダプタとして一般化。handleMcpMessage(純関数)を Web 標準 Request/Response に橋渡しする。
// Next.js Route Handler / Amplify(serverless)など、セッションを持てない環境でそのまま動く。

/**
 * Authorization ヘッダから Bearer トークンを取り出す。
 *
 * @param authorizationHeader Authorization ヘッダの値
 * @returns トークン。**無ければ null**
 */
export function extractBearerToken(authorizationHeader: string | null | undefined): string | null {
  if (!authorizationHeader) return null;
  const m = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  return m ? (m[1] ?? "").trim() || null : null;
}

/** HTTP MCP のオプション。認可はトークン検証関数として注入する(基盤はトークンの保存方式を規定しない)。 */
export interface HttpMcpOptions {
  server: McpServerOptions;
  /**
   * Bearer トークンを検証して呼び出しコンテキストを返す。null を返すと 401。
   * 省略時は認証なし(ローカル/信頼済みネットワーク前提)。
   */
  authenticate?: (token: string | null, request: Request) => Promise<McpCallContext | null> | McpCallContext | null;
  /** 401 応答の WWW-Authenticate に載せる resource_metadata URL(RFC 9728・任意)。 */
  resourceMetadataUrl?: string;
}

const jsonResponse = (body: unknown, status: number, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

/**
 * Web 標準 Request を受けて MCP の JSON-RPC を処理し Response を返す(Streamable HTTP・stateless)。
 * - POST のみ受け付ける(GET/DELETE は 405)。
 * - 認証失敗は 401 + WWW-Authenticate(resourceMetadataUrl 指定時)。
 * - 通知(id なし)は 202 で本文なし。
 *
 * @example (Next.js route.ts)
 * ```ts
 * export const POST = (req: Request) => handleHttpMcp(req, {
 *   server: { name: "app", version: "1", tools },
 *   authenticate: async (token) => token ? { subject: await verify(token) } : null,
 *   resourceMetadataUrl: `${base}/.well-known/oauth-protected-resource`,
 * });
 * ```
 *
 * @param request HTTP リクエスト
 * @param options ツールの実装と認証をまとめて渡す({@link HttpMcpOptions})。
 *   `authenticate` を設定すれば Bearer を検証する。
 *   **以前この説明は `handlers` を別引数として書いていた**が、実装では options の一部
 * @returns HTTP レスポンス
 */
export async function handleHttpMcp(request: Request, options: HttpMcpOptions): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "POST のみ対応しています" } }, 405, { allow: "POST" });
  }

  let ctx: McpCallContext = {};
  if (options.authenticate) {
    const token = extractBearerToken(request.headers.get("authorization"));
    const authed = await options.authenticate(token, request);
    if (!authed) {
      const headers: Record<string, string> = {};
      if (options.resourceMetadataUrl) headers["www-authenticate"] = `Bearer resource_metadata="${options.resourceMetadataUrl}"`;
      return jsonResponse({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "認証が必要です" } }, 401, headers);
    }
    ctx = authed;
  }

  let bodyText: string;
  try {
    bodyText = await request.text();
  } catch {
    return jsonResponse({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "本文を読み取れません" } }, 400);
  }

  const parsed = parseJsonRpc(bodyText);
  if (!parsed.ok) return jsonResponse(parsed.error, 400);

  const res = await handleMcpMessage(options.server, parsed.value, ctx);
  if (res === null) return new Response(null, { status: 202 }); // 通知(応答不要)
  return jsonResponse(res, 200);
}

